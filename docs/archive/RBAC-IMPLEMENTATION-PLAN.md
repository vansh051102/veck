# RBAC Implementation Plan — VECK

> **Status:** Shipped — archived (RBAC landed at `c952042`; see backlog Phase 0 #1)
> **Date:** July 2026
> **Scope:** Role-Based Access Control with Department + Ownership scoping

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Phase 1: Database Schema Changes](#2-phase-1-database-schema-changes)
3. [Phase 2: Permission String System](#3-phase-2-permission-string-system)
4. [Phase 3: Ownership Filtering Rules](#4-phase-3-ownership-filtering-rules)
5. [Phase 4: Implementation Steps](#5-phase-4-implementation-steps)
6. [Phase 5: Migration Strategy](#6-phase-5-migration-strategy)
7. [File Change Summary](#7-file-change-summary)
8. [Implementation Order](#8-implementation-order)

---

## 1. Current State Summary

### Auth System
- **Library:** Supabase Auth (`@supabase/supabase-js` v2.38 + `@supabase/auth-helpers-nextjs` v0.7)
- **Login:** Browser client calls `supabaseBrowser.auth.signInWithPassword({ email, password })`
- **Session:** Supabase manages JWT in cookies automatically
- **Server-side validation:** `supabase.auth.getUser(token)` verifies JWT with Supabase servers

### User Model (current)
```prisma
model User {
  id                String    @id @default(uuid())
  orgId             String
  email             String    @unique
  fullName          String
  avatarUrl         String?
  role              String    @default("user")   // admin, manager, user, viewer
  status            String    @default("active") // active, inactive, suspended
  lastLogin         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### Role Model (current — EXISTS but UNUSED)
```prisma
model Role {
  id                String    @id @default(uuid())
  orgId             String
  name              String    // admin, sales_manager, sales_rep, viewer
  permissions       Json      // ["leads:create", "leads:read", ...]
  description       String?
}
```

### RBAC Functions (current — EXIST but UNUSED in `lib/auth.ts`)
- `checkPermission(userId, permission)` — looks up Role.permissions JSON array
- `hasAnyPermission(userId, permissions[])` — returns true if ANY permission matches
- `hasAllPermissions(userId, permissions[])` — returns true if ALL permissions match
- `createRole(orgId, name, permissions[], description?)` — creates a Role record
- `updateRole(roleId, permissions[], description?)` — updates a Role's permissions
- `assignRoleToUser(userId, role)` — updates User.role string

### Middleware (current)
- Edge middleware resolves Supabase session → calls `/api/internal/session` over HTTP
- Internal session route returns `{ id, orgId, role, status }` from Prisma
- Injects `x-user-id`, `x-org-id`, `x-user-role` headers for downstream routes
- Admin route protection: `/admin` requires `role === 'admin'`

### API Routes (current)
- 28 routes under `/api/v1/`
- Only 4 have role checks (all hardcoded `role !== 'admin'`):
  - `PUT /settings` — admin only
  - `POST /leads/import` — admin only
  - `GET /leads/export` — admin only
  - Middleware `/admin` routes — admin only
- Analytics route: role-scoped data (admin/manager see all, others see own)

### Frontend (current)
- No React Context or Zustand for auth
- `useCurrentUser()` hook: fetches `/auth/me`, returns `{ id, email, fullName, role }`
- Sidebar: 4 hardcoded nav items, no role filtering
- Settings page: `me?.role === 'admin'` check for UI gating

---

## 2. Phase 1: Database Schema Changes

### 2.1 Enhance User Model

Add organizational fields to support Role + Department + Ownership:

```prisma
model User {
  // ... existing fields unchanged ...

  // NEW FIELDS
  department        String?   // FK to Master where type='department'
  designation       String?   // FK to Master where type='designation'
  reportsToId       String?   // self-referential FK (manager)
  reportsTo         User?     @relation("ReportsTo", fields: [reportsToId], references: [id])
  directReports     User[]    @relation("ReportsTo")
  territory         String?   // e.g. "North India", "West India"
  branch            String?   // e.g. "Delhi", "Mumbai"
  defaultDashboard  String?   // route path to redirect after login

  @@index([department])
  @@index([designation])
}
```

### 2.2 Enhance Role Model

Add department scoping and hierarchy level:

```prisma
model Role {
  // ... existing fields unchanged ...

  // NEW FIELDS
  department        String?   // which department this role belongs to (null = org-wide)
  hierarchyLevel    Int       @default(0) // 0=base, 1=manager, 2=admin (for permission inheritance)
}
```

---

## 3. Phase 2: Permission String System

### 3.1 Permission Format

```
resource:action
```

### 3.2 All Resources & Actions

| Resource | Actions |
|----------|---------|
| `leads` | `create`, `read`, `edit`, `delete`, `assign`, `export`, `import` |
| `contacts` | `create`, `read`, `edit` |
| `activities` | `create`, `read`, `edit`, `delete` |
| `quotes` | `create`, `read`, `edit`, `send` |
| `purchase_requests` | `create`, `read`, `edit` |
| `checklists` | `create`, `read`, `edit` |
| `analytics` | `read` |
| `settings` | `read`, `edit` |
| `users` | `create`, `read`, `edit`, `delete` |
| `roles` | `create`, `read`, `edit` |
| `master_data` | `create`, `read`, `edit` |
| `reports` | `read` |

### 3.3 Role → Permission Mapping

#### Admin (Main Admin)
```
* (wildcard — all permissions)
```

#### Marketing Manager
```
leads:create, leads:read, leads:edit
contacts:create, contacts:read, contacts:edit
activities:create, activities:read, activities:edit, activities:delete
analytics:read
```
- Can see ALL leads created by marketing department (not just own)

#### Marketing Executive
```
leads:create, leads:read, leads:edit
contacts:create, contacts:read, contacts:edit
activities:create, activities:read
```
- Can ONLY see leads they created (ownership filter: `createdById = userId`)

#### Sales Manager
```
leads:read, leads:edit, leads:assign
contacts:read
activities:create, activities:read, activities:edit, activities:delete
quotes:read
analytics:read
```
- Can see ALL leads assigned to sales department

#### Sales Executive
```
leads:read, leads:edit
contacts:read
activities:create, activities:read
quotes:read
```
- Can ONLY see leads assigned to them (ownership filter: `assignedToId = userId`)

#### Purchase / Quotation Team
```
leads:read
quotes:create, quotes:read, quotes:edit, quotes:send
purchase_requests:create, purchase_requests:read, purchase_requests:edit
checklists:create, checklists:read, checklists:edit
```
- Can ONLY see leads in Qualified or Quote Sent stages

---

## 4. Phase 3: Ownership Filtering Rules

### 4.1 Data Visibility by Role

| Role | Lead Visibility | Contact Visibility | Quote Visibility |
|------|----------------|-------------------|-----------------|
| Admin | All org leads | All org contacts | All org quotes |
| Marketing Manager | All leads created by marketing dept | All contacts created by marketing dept | — |
| Marketing Executive | Only leads they created | Contacts they created | — |
| Sales Manager | All leads assigned to sales dept | All contacts | All quotes on those leads |
| Sales Executive | Only leads assigned to them | Contacts on their leads | Read-only on their leads |
| Purchase | Only leads in Qualified/Quote Sent | Contacts on those leads | Create/edit on those leads |

### 4.2 Backend Enforcement Pattern

Every API route will follow this pattern:

```ts
export const GET = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  const role = extractUserRole(req.headers)
  const department = extractUserDepartment(req.headers)

  // 1. Check permission
  await requirePermission(userId, 'leads:read')

  // 2. Build ownership filter
  const ownershipFilter = buildOwnershipFilter(userId, role, department, 'leads')

  // 3. Query with combined filter
  const leads = await prisma.lead.findMany({
    where: { orgId, ...ownershipFilter },
  })

  return successResponse(leads)
})
```

### 4.3 Ownership Filter Rules

```ts
function buildOwnershipFilter(userId, role, department, resource) {
  switch (role) {
    case 'admin':
      return {} // no filter — sees everything

    case 'marketing_manager':
      return { createdBy: { department: 'Marketing' } }

    case 'marketing_executive':
      return { createdById: userId }

    case 'sales_manager':
      return { assignedTo: { department: 'Sales' } }

    case 'sales_executive':
      return { assignedToId: userId }

    case 'purchase':
      return { stage: { in: ['Qualified', 'Quote Sent'] } }

    default:
      return { id: 'no-match' } // deny all
  }
}
```

---

## 5. Phase 4: Implementation Steps

### Step 1: Create RBAC Utility Library (`lib/rbac.ts`)

New file containing:
- `PERMISSIONS` constant — all valid permission strings as a typed array
- `ROLE_PERMISSIONS` map — default permissions per role name
- `getUserPermissions(userId)` — fetches user's role, returns permission array from Role table
- `requirePermission(userId, permission)` — checks permission, throws ForbiddenError if missing
- `buildOwnershipFilter(userId, role, department, resource)` — returns Prisma `where` clauses

### Step 2: Enhance `lib/use-current-user.ts`

Expand the `CurrentUser` interface:

```ts
export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: string
  department: string | null
  designation: string | null
  permissions: string[]  // loaded from Role.permissions
}
```

### Step 3: Enhance Middleware + Session Route

**Session route** (`app/api/internal/session/route.ts`) — return additional fields:
```ts
return {
  id: user.id,
  orgId: user.orgId,
  role: user.role,
  status: user.status,
  department: user.department,
  designation: user.designation,
}
```

**Middleware** (`middleware.ts`) — inject additional headers:
```ts
requestHeaders.set('x-user-department', sessionData.department ?? '')
requestHeaders.set('x-user-designation', sessionData.designation ?? '')
```

### Step 4: Enhance `lib/api-response.ts`

Add header extraction helpers:
```ts
export function extractUserDepartment(headers: Headers): string | null {
  return headers.get('x-user-department') || null
}

export function extractUserDesignation(headers: Headers): string | null {
  return headers.get('x-user-designation') || null
}
```

### Step 5: Create Role Seeding (`lib/seed-roles.ts`)

Function to create default roles for a new org:

```ts
export async function seedDefaultRoles(orgId: string) {
  const roles = [
    { name: 'admin', permissions: ['*'], department: null, hierarchyLevel: 2 },
    { name: 'marketing_manager', permissions: [...], department: 'Marketing', hierarchyLevel: 1 },
    { name: 'marketing_executive', permissions: [...], department: 'Marketing', hierarchyLevel: 0 },
    { name: 'sales_manager', permissions: [...], department: 'Sales', hierarchyLevel: 1 },
    { name: 'sales_executive', permissions: [...], department: 'Sales', hierarchyLevel: 0 },
    { name: 'purchase', permissions: [...], department: 'Purchase', hierarchyLevel: 0 },
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { orgId_name: { orgId, name: role.name } },
      create: { orgId, ...role },
      update: {},
    })
  }
}
```

### Step 6: Update All 28 API Routes

For each route, add permission checks and ownership filtering:

| Route | Permission Required | Ownership Filter |
|-------|-------------------|-----------------|
| `POST /leads` | `leads:create` | — |
| `GET /leads` | `leads:read` | By role (see 4.1) |
| `PUT /leads/:id` | `leads:edit` | Must own or be assigned |
| `DELETE /leads/:id` | `leads:delete` | Admin only |
| `PUT /leads/:id/stage` | `leads:edit` | Must be assigned |
| `PUT /leads/:id/assign` | `leads:assign` | Admin/Manager only |
| `POST /leads/:id/activities` | `activities:create` | Must own or be assigned lead |
| `GET /leads/:id/activities` | `activities:read` | Must own or be assigned lead |
| `POST /leads/:id/quotes` | `quotes:create` | Must be purchase role |
| `GET /leads/:id/quotes` | `quotes:read` | By role |
| `POST /leads/:id/purchase-requests` | `purchase_requests:create` | Must be purchase role |
| `GET /leads/:id/purchase-requests` | `purchase_requests:read` | By role |
| `POST /leads/:id/checklists` | `checklists:create` | Must own or be assigned lead |
| `GET /leads/:id/checklists` | `checklists:read` | By role |
| `GET /quotes/:id` | `quotes:read` | By role |
| `PUT /quotes/:id` | `quotes:edit` | Must be purchase role |
| `POST /quotes/:id/send` | `quotes:send` | Must be purchase role |
| `GET /purchase-requests/:id` | `purchase_requests:read` | By role |
| `PUT /purchase-requests/:id` | `purchase_requests:edit` | Must be purchase role |
| `POST /contacts` | `contacts:create` | — |
| `GET /contacts` | `contacts:read` | By role |
| `PUT /contacts/:id` | `contacts:edit` | By role |
| `PUT /activities/:id` | `activities:edit` | Must own activity |
| `DELETE /activities/:id` | `activities:delete` | Admin/Manager only |
| `GET /analytics` | `analytics:read` | By role |
| `PUT /settings` | `settings:edit` | Admin only |
| `POST /leads/import` | `leads:import` | Admin only |
| `GET /leads/export` | `leads:export` | Admin/Manager only |
| `GET /users` | `users:read` | Admin/Manager only |

### Step 7: Update Frontend Sidebar

Make sidebar dynamic based on user permissions:

```tsx
const NAV_CONFIG = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: [] },
  { href: '/leads', label: 'Leads', icon: Users, permissions: ['leads:read'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, permissions: ['analytics:read'] },
  { href: '/settings', label: 'Settings', icon: Settings, permissions: ['settings:edit'] },
]

// Filter based on user permissions
const visibleItems = NAV_CONFIG.filter(item =>
  item.permissions.length === 0 ||
  item.permissions.some(p => user.permissions.includes(p))
)
```

### Step 8: Create Permission Gate Component

New file `components/permission-gate.tsx`:

```tsx
'use client'

import { useCurrentUser } from '@/lib/use-current-user'

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const user = useCurrentUser()
  if (!user?.permissions?.includes(permission)) return <>{fallback}</>
  return <>{children}</>
}
```

Usage throughout pages:
```tsx
<PermissionGate permission="leads:assign">
  <AssignButton lead={lead} />
</PermissionGate>

<PermissionGate permission="leads:delete">
  <DeleteButton lead={lead} />
</PermissionGate>
```

### Step 9: Frontend Data Filtering

For the leads list page, enforce visibility on the client side too:

```tsx
// In leads page
const user = useCurrentUser()

// Marketing Executive: only show "My Leads" tab
// Sales Executive: only show "My Leads" tab
// Purchase: only show Qualified/Quote Sent stages
const visibleStages = visibleStagesForRole(user?.role ?? 'user')
```

This is IN ADDITION to backend filtering (belt and suspenders approach).

### Step 10: User Management UI

Expand `app/(app)/settings/page.tsx` to include:

**User Management section** (admin only):
- List all users with department, designation, role, status
- Create new users with department/designation assignment
- Edit user roles and department
- Activate/deactivate users

**Role Management section** (admin only):
- List all roles with permissions
- View/edit role permissions
- Create custom roles

---

## 6. Phase 5: Migration Strategy

### 6.1 Schema Migration
```bash
npx prisma migrate dev --name add-rbac-fields
```

### 6.2 Backfill Existing Users
Set `department` and `designation` based on current `role` string:
- `role: 'admin'` → `department: 'Management', designation: 'Admin'`
- `role: 'manager'` → infer department from context, `designation: 'Manager'`
- `role: 'user'` → leave null (admin fills in later)

### 6.3 Seed Roles
Run `seedDefaultRoles()` for each existing org to create the Role records.

### 6.4 Deploy
- Middleware changes are backward-compatible (new headers are additive)
- Existing `role` string field stays on User model
- New permission system layers on top

### 6.5 No Breaking Changes
- Old `role` field still works for any code that checks it
- New permission system is strictly more granular
- Frontend gracefully handles missing permissions array (defaults to empty)

---

## 7. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `prisma/schema.prisma` | MODIFY | Add department, designation, reportsToId, territory, branch, defaultDashboard to User. Add department, hierarchyLevel to Role. |
| `lib/rbac.ts` | **CREATE** | Permission constants, role mappings, permission checker, data filter builder |
| `lib/seed-roles.ts` | **CREATE** | Default role seeding for new orgs |
| `lib/auth.ts` | MODIFY | Update `checkPermission()` to use new RBAC system, add `getUserPermissions()` |
| `lib/use-current-user.ts` | MODIFY | Expand CurrentUser to include department, designation, permissions |
| `lib/api-response.ts` | MODIFY | Add `extractUserDepartment()`, `extractUserDesignation()` |
| `middleware.ts` | MODIFY | Inject department/designation headers |
| `app/api/internal/session/route.ts` | MODIFY | Return department/designation |
| `app/api/v1/auth/me/route.ts` | MODIFY | Return permissions array |
| `components/sidebar.tsx` | MODIFY | Dynamic nav based on permissions |
| `components/permission-gate.tsx` | **CREATE** | Permission guard component |
| `app/(app)/settings/page.tsx` | MODIFY | User management + role management UI |
| `app/(app)/leads/page.tsx` | MODIFY | Role-based tab visibility + ownership filtering |
| `app/api/v1/leads/route.ts` | MODIFY | Add permission checks + ownership filtering |
| `app/api/v1/leads/[id]/route.ts` | MODIFY | Add permission checks + ownership filtering |
| `app/api/v1/leads/[id]/stage/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/[id]/assign/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/[id]/activities/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/[id]/quotes/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/[id]/purchase-requests/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/[id]/checklists/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/quotes/[id]/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/quotes/[id]/send/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/purchase-requests/[id]/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/contacts/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/contacts/[id]/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/activities/[id]/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/analytics/route.ts` | MODIFY | Add permission checks + ownership filtering |
| `app/api/v1/settings/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/users/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/import/route.ts` | MODIFY | Add permission checks |
| `app/api/v1/leads/export/route.ts` | MODIFY | Add permission checks |

---

## 8. Implementation Order

| Step | Description | Dependencies |
|------|-------------|-------------|
| 1 | Schema migration (`prisma/schema.prisma`) | None |
| 2 | `lib/rbac.ts` — permission system core | Step 1 |
| 3 | `lib/seed-roles.ts` — default role seeding | Step 1, 2 |
| 4 | `lib/auth.ts` + `lib/api-response.ts` updates | Step 2 |
| 5 | `middleware.ts` + `app/api/internal/session/route.ts` | Step 1 |
| 6 | `app/api/v1/auth/me/route.ts` — return permissions | Step 2 |
| 7 | API route permission enforcement (batch) | Step 2, 4 |
| 8 | `lib/use-current-user.ts` — expanded interface | Step 6 |
| 9 | `components/permission-gate.tsx` — guard component | Step 8 |
| 10 | `components/sidebar.tsx` — dynamic rendering | Step 8 |
| 11 | Page-level permission gating | Step 9 |
| 12 | Settings page — user management UI | Step 3 |
| 13 | Run migration + seed existing orgs | Step 1, 3 |
| 14 | Verify build passes | All steps |

---

## Permission Checklist (Quick Reference)

### What each role CAN do:

| Action | Admin | Mktg Mgr | Mktg Exec | Sales Mgr | Sales Exec | Purchase |
|--------|-------|----------|-----------|-----------|------------|----------|
| Create leads | Yes | Yes | Yes | No | No | No |
| View all leads | Yes | Mktg dept | Own only | Sales dept | Assigned only | Qualified/Quote Sent |
| Edit leads | Yes | Yes | Yes | Yes | Yes | No |
| Delete leads | Yes | No | No | No | No | No |
| Assign leads | Yes | Yes | No | Yes | No | No |
| Export leads | Yes | No | No | Yes | No | No |
| Import leads | Yes | No | No | No | No | No |
| Create contacts | Yes | Yes | Yes | No | No | No |
| Log activities | Yes | Yes | Yes | Yes | Yes | No |
| Create quotes | Yes | No | No | No | No | Yes |
| Edit quotes | Yes | No | No | No | No | Yes |
| Send quotes | Yes | No | No | No | No | Yes |
| Create purchase requests | Yes | No | No | No | No | Yes |
| View analytics | Yes | Yes | No | Yes | No | No |
| Edit settings | Yes | No | No | No | No | No |
| Manage users | Yes | No | No | No | No | No |
| Manage roles | Yes | No | No | No | No | No |

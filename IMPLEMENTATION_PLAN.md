# VECK CRM - 4-Phase Implementation Plan

**Project:** Process-driven steel trading CRM operating system  
**Current Date:** 2026-07-05  
**Tech Stack:** Next.js 14, TypeScript, React, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL (Supabase), Zustand, React Hook Form, TanStack Table  
**Hosting:** Vercel (frontend), Supabase (backend/DB), Cloudflare R2 (file storage)

---

## PHASE 0: Foundation & Platform (Week 1-2)

### Overview
Build the core infrastructure, authentication, and admin framework that all phases depend on.

### 1.1 Database Schema & Prisma Setup

#### Core Models
```
┌─────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                      │
├─────────────────────────────────────────────────────────┤
│
│ Organizations (Workspace Management)
│ ├─ id (UUID, PK)
│ ├─ name (String)
│ ├─ slug (String, unique)
│ ├─ created_at (DateTime)
│ ├─ subscription_plan (ENUM: free, pro, enterprise)
│ └─ custom_fields_config (JSON) -- extensible for phase 2+
│
│ Users
│ ├─ id (UUID, PK)
│ ├─ org_id (FK → Organizations)
│ ├─ email (String, unique)
│ ├─ password_hash (String, via Supabase Auth)
│ ├─ full_name (String)
│ ├─ avatar_url (String, optional)
│ ├─ role (ENUM: admin, manager, user, viewer)
│ ├─ status (ENUM: active, inactive, suspended)
│ ├─ created_at (DateTime)
│ ├─ last_login (DateTime)
│ └─ updated_at (DateTime)
│
│ Roles (RBAC - Role-Based Access Control)
│ ├─ id (UUID, PK)
│ ├─ org_id (FK → Organizations)
│ ├─ name (String: admin, sales_manager, sales_rep, viewer)
│ ├─ permissions (JSON: array of permission strings)
│ │  Examples: "leads:create", "leads:edit", "leads:delete", 
│ │           "leads:view_all", "leads:view_own", "quotes:create"
│ └─ created_at (DateTime)
│
│ Permissions (Reference)
│ ├─ resource (String: leads, quotes, orders, users)
│ ├─ action (String: create, read, update, delete, export)
│ └─ description (String)
│
│ Audit Logs
│ ├─ id (UUID, PK)
│ ├─ org_id (FK → Organizations)
│ ├─ user_id (FK → Users)
│ ├─ action (String: created, updated, deleted, exported)
│ ├─ resource_type (String: lead, quote, order)
│ ├─ resource_id (UUID)
│ ├─ changes (JSON: { before, after })
│ ├─ ip_address (String)
│ ├─ timestamp (DateTime)
│ └─ created_at (DateTime)
│
│ Settings (Organization Configuration)
│ ├─ id (UUID, PK)
│ ├─ org_id (FK → Organizations, unique)
│ ├─ sla_default_hours (Integer: default 24)
│ ├─ currency (String: INR, USD)
│ ├─ date_format (ENUM: DD/MM/YYYY, MM/DD/YYYY)
│ ├─ timezone (String: Asia/Kolkata)
│ ├─ workflow_stages (JSON: custom stages)
│ ├─ auto_assignment_enabled (Boolean)
│ ├─ webhook_url (String, optional)
│ ├─ updated_at (DateTime)
│ └─ updated_by (FK → Users)
│
└─────────────────────────────────────────────────────────┘
```

#### Prisma Configuration
```
File: prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Organization {
  id                String    @id @default(uuid())
  name              String
  slug              String    @unique
  subscriptionPlan  String    @default("free")
  customFieldsConfig Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  users             User[]
  roles             Role[]
  auditLogs         AuditLog[]
  settings          Settings?
  leads             Lead[]
  contacts          Contact[]
  masters           Master[]
}

model User {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  email             String    @unique
  fullName          String
  avatarUrl         String?
  role              String    @default("user")
  status            String    @default("active")
  lastLogin         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  auditLogs         AuditLog[]
  assignedLeads     Lead[]    @relation("assignedTo")
  createdLeads      Lead[]    @relation("createdBy")
}

model Role {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name              String
  permissions       Json      // ["leads:create", "leads:read", ...]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([orgId, name])
}

model AuditLog {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  action            String    // created, updated, deleted
  resourceType      String    // lead, quote
  resourceId        String
  changes           Json      // { before: {}, after: {} }
  ipAddress         String?
  timestamp         DateTime  @default(now())

  @@index([orgId, userId])
  @@index([resourceType, resourceId])
}

model Settings {
  id                String    @id @default(uuid())
  orgId             String    @unique
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  slaDefaultHours   Int       @default(24)
  currency          String    @default("INR")
  dateFormat        String    @default("DD/MM/YYYY")
  timezone          String    @default("Asia/Kolkata")
  workflowStages    Json      // { stages: ["New Lead", "Contacted", ...] }
  autoAssignmentEnabled Boolean @default(false)
  webhookUrl        String?
  updatedAt         DateTime  @updatedAt
  updatedBy         String
}

// More models in next section...
```

#### Migration Strategy
- **Development:** Use Supabase free tier with local `supabase start`
- **Migrations:** `prisma migrate dev --name <name>`
- **Staging:** Separate Supabase project with anonymized production data
- **Production:** Supabase pro tier with automated backups

### 1.2 Authentication & Authorization

#### Supabase Auth Flow
```
┌──────────────┐
│   Sign Up    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Supabase Auth (Email + Password)    │
│  - JWT tokens (access + refresh)     │
│  - Session management                │
│  - MFA optional (phase 2)            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Create User in DB                   │
│  - Link to Organization              │
│  - Assign default role (user/viewer) │
│  - Initialize workspace              │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Middleware: Next.js Middleware      │
│  - Verify JWT on protected routes    │
│  - Check org membership              │
│  - Enforce role-based access         │
└──────────────────────────────────────┘
```

#### Implementation Details

**File: lib/auth.ts**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function signUp(email: string, password: string, fullName: string, orgName: string) {
  // 1. Create Supabase user
  const { data: { user }, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (authError) throw authError
  
  // 2. Create organization
  const { data: org } = await prisma.organization.create({
    data: {
      name: orgName,
      slug: orgName.toLowerCase().replace(/\s+/g, '-'),
      subscriptionPlan: 'free',
    }
  })
  
  // 3. Create user in database
  await prisma.user.create({
    data: {
      id: user!.id,
      email,
      fullName,
      orgId: org.id,
      role: 'admin'
    }
  })
  
  return { user, org }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function getCurrentUser(session: Session) {
  if (!session?.user) return null
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { org: true }
  })
  
  return user
}

export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      org: {
        include: {
          roles: {
            where: { name: user.role }
          }
        }
      }
    }
  })
  
  if (!user?.org?.roles[0]) return false
  const permissions = user.org.roles[0].permissions as string[]
  return permissions.includes(permission)
}
```

**File: middleware.ts**
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if needed
  await supabase.auth.getSession()

  // Protected routes
  const protectedPaths = ['/dashboard', '/leads', '/admin']
  const isProtected = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path))

  if (isProtected) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    // Get user org from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    // Attach user info to request
    res.headers.set('x-user-id', user.id)
    res.headers.set('x-org-id', user.orgId)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### 1.3 Admin Portal Structure

#### Pages & Components
```
/app/admin/
├── layout.tsx (admin wrapper with sidebar)
├── page.tsx (admin dashboard)
├── users/
│   ├── page.tsx (users list)
│   ├── [id]/
│   │   └── page.tsx (edit user)
│   └── new/
│       └── page.tsx (create user)
├── roles/
│   ├── page.tsx (roles list)
│   └── [id]/
│       └── page.tsx (edit permissions)
├── settings/
│   ├── page.tsx (org settings)
│   ├── workflow/
│   │   └── page.tsx (workflow stages)
│   ├── masters/
│   │   └── page.tsx (master data management)
│   └── integrations/
│       └── page.tsx (webhooks, API keys)
├── audit-logs/
│   └── page.tsx (audit trail)
├── import-export/
│   └── page.tsx (data import/export)
└── dashboards/
    └── page.tsx (analytics)
```

#### Admin Dashboard Features
- User management (create, edit, deactivate, role assignment)
- Role management (create custom roles with permission matrix)
- Organization settings (SLA defaults, workflow stages, timezone)
- Master data management (supplier list, product categories, pricing tiers)
- Audit logs viewer with filtering
- Bulk import (CSV for users, suppliers, masters)
- Bulk export (leads, orders, invoices)
- System health dashboard (API usage, storage, performance)

### 1.4 API Architecture

#### Base Structure
```
/app/api/v1/
├── auth/
│   ├── signup/route.ts
│   ├── signin/route.ts
│   ├── signout/route.ts
│   ├── refresh/route.ts
│   └── me/route.ts
├── users/
│   ├── route.ts (GET all, POST create)
│   ├── [id]/route.ts (GET, PUT, DELETE)
│   └── [id]/permissions/route.ts
├── roles/
│   ├── route.ts
│   └── [id]/route.ts
├── settings/
│   ├── route.ts
│   ├── workflow-stages/route.ts
│   └── masters/route.ts
├── audit-logs/
│   └── route.ts
└── health/
    └── route.ts
```

#### Response Format (Standardized)
```typescript
// Success
{
  success: true,
  data: { ... },
  meta: {
    timestamp: "2026-07-05T10:30:00Z",
    version: "1.0"
  }
}

// Error
{
  success: false,
  error: {
    code: "UNAUTHORIZED",
    message: "User does not have permission",
    details: { ... }
  },
  meta: {
    timestamp: "2026-07-05T10:30:00Z",
    version: "1.0"
  }
}

// Paginated
{
  success: true,
  data: [ ... ],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}
```

#### Error Handling Strategy
```typescript
// Custom error classes
class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
  }
}

class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details)
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message)
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message)
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`)
  }
}

// Global error handler
export function errorHandler(error: any) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.statusCode }
    )
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error)
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    },
    { status: 500 }
  )
}
```

### 1.5 Frontend Infrastructure

#### Directory Structure
```
/app/
├── layout.tsx (root layout with providers)
├── auth/
│   ├── layout.tsx
│   ├── signup/page.tsx
│   └── login/page.tsx
├── dashboard/
│   ├── layout.tsx (dashboard wrapper with sidebar)
│   └── page.tsx
├── admin/
│   └── ... (admin routes)
└── api/
    └── ... (API routes)

/components/
├── layout/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Nav.tsx
├── common/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Table.tsx
│   ├── Modal.tsx
│   ├── Dropdown.tsx
│   ├── Toast.tsx
│   └── Loading.tsx
├── forms/
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   └── UserForm.tsx
├── admin/
│   ├── UsersList.tsx
│   ├── RolesManager.tsx
│   ├── SettingsForm.tsx
│   └── AuditLogViewer.tsx
└── [feature]/
    └── ...

/lib/
├── api-client.ts (fetch wrapper with auth)
├── auth.ts (auth utilities)
├── db.ts (Prisma client)
├── permissions.ts (permission checking)
├── utils.ts (helpers)
├── constants.ts (enums, config)
└── validation.ts (Zod schemas)

/hooks/
├── useAuth.ts (auth context)
├── useOrg.ts (org context)
├── useUser.ts (user data)
├── useApi.ts (fetch with loading/error)
└── useForm.ts (form state)

/stores/
├── authStore.ts (Zustand)
├── uiStore.ts (modal, toast, sidebar state)
└── appStore.ts (global app state)

/styles/
├── globals.css
├── tailwind.config.ts
└── fonts/
```

#### State Management (Zustand)
```typescript
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  org: Organization | null
  isLoading: boolean
  setUser: (user: User) => void
  setOrg: (org: Organization) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  org: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setOrg: (org) => set({ org }),
  logout: () => set({ user: null, org: null })
}))

// Load auth on mount
export async function initAuth() {
  const { setUser, setOrg } = useAuthStore.getState()
  const response = await fetch('/api/v1/auth/me')
  if (response.ok) {
    const { user, org } = await response.json()
    setUser(user)
    setOrg(org)
  }
}
```

### 1.6 Testing Strategy - Phase 0

#### Unit Tests
- Auth utilities (permission checking, token validation)
- API helpers (error handling, response formatting)
- Utility functions (date formatting, validation)

#### Integration Tests
- User signup/signin flow
- Permission enforcement
- Database operations

#### E2E Tests
- Login flow
- Admin user creation
- Role assignment

**Testing Tools:**
- Jest (unit + integration)
- Playwright (E2E)
- Mock data factories (Faker.js)

### 1.7 Deployment Checklist - Phase 0

- [ ] Supabase project created (dev + staging + prod)
- [ ] Environment variables configured (.env.local, .env.production)
- [ ] Database migrations applied to staging
- [ ] Vercel project connected to GitHub
- [ ] Cloudflare R2 bucket created for file storage
- [ ] Email service configured (Resend for transactional emails)
- [ ] GitHub secrets configured (DATABASE_URL, SUPABASE_KEYS, etc.)
- [ ] SSL certificate configured
- [ ] Monitoring setup (error tracking, performance metrics)
- [ ] Backup strategy documented

### 1.8 Documentation - Phase 0

**Files to Create:**
- `docs/ARCHITECTURE.md` - System design overview
- `docs/API.md` - API endpoint documentation
- `docs/DATABASE.md` - Database schema and migrations
- `docs/AUTH.md` - Authentication flow and RBAC
- `docs/SETUP.md` - Local development setup
- `docs/DEPLOYMENT.md` - Deployment procedures

---

## PHASE 1: CRM & Sales (Week 3-8)

### Overview
Build the complete lead management system with workflow enforcement, SLA tracking, and sales pipeline.

### 2.1 Extended Database Schema

#### Lead Management Models
```
model Contact {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Personal info
  firstName         String
  lastName          String
  email             String
  phone             String
  alternatePhone    String?
  designation       String?
  
  // Company association (added in phase 2)
  companyId         String?
  
  // Metadata
  source            String    // Website, LinkedIn, Referral, etc.
  sourceDetails     Json?     // { url, campaign, medium }
  tags              String[]  @default([])
  customFields      Json?     // Extensible for custom columns
  
  // Timestamps
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdBy         String    @relation("contactCreatedBy", fields: [createdById], references: [id])
  createdById       String
  
  // Relations
  leads             Lead[]
  timeline          Timeline[]
  
  @@index([orgId, email])
  @@index([source])
}

model Lead {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Contact info
  contactId         String
  contact           Contact   @relation(fields: [contactId], references: [id], onDelete: Restrict)
  companyName       String
  
  // Lead workflow
  stage             String    @default("New Lead") // New Lead, Contacted, Qualified, Quote Sent, Closed Won, Deal Lost, Disqualified
  stageChangedAt    DateTime  @default(now())
  stageChangedBy    String?
  
  // Classification
  priority          String    @default("Medium") // Low, Medium, High, Urgent
  status            String    @default("open") // open, closed_won, closed_lost, disqualified
  dealLostReason    String?   // Why deal was lost
  
  // Assignment
  assignedTo        String?   @relation("leadAssignedTo", fields: [assignedToId], references: [id])
  assignedToId      String?
  assignedAt        DateTime?
  
  // Metadata
  source            String    // Website, LinkedIn, Referral, Email, etc.
  sourceDetails     Json?     // Campaign, UTM parameters, etc.
  notes             String?
  customFields      Json?     // Extensible custom fields
  tags              String[]  @default([])
  
  // SLA Tracking
  slaCreatedAt      DateTime  @default(now())
  slaDeadline       DateTime  // Calculated based on organization SLA settings
  slaBreached       Boolean   @default(false)
  firstResponseAt   DateTime?
  
  // Engagement metrics
  viewCount         Int       @default(0)
  lastViewedAt      DateTime?
  lastActivityAt    DateTime  @default(now())
  
  // Timestamps
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdBy         String    @relation("leadCreatedBy", fields: [createdById], references: [id])
  createdById       String
  
  // Relations
  checklists        Checklist[]
  timeline          Timeline[]
  activities        Activity[]
  quotes            Quote[]
  purchaseRequests  PurchaseRequest[]
  
  @@index([orgId, stage])
  @@index([assignedToId])
  @@index([status])
  @@index([slaDeadline])
  @@index([createdAt])
}

model Checklist {
  id                String    @id @default(uuid())
  orgId             String
  leadId            String
  lead              Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  title             String    // "Initial Qualification", "Technical Assessment", etc.
  description       String?
  isRequired        Boolean   @default(false) // Block stage progression if incomplete
  
  // Items
  items             ChecklistItem[]
  
  // Status
  completedAt       DateTime?
  completedBy       String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([leadId])
}

model ChecklistItem {
  id                String    @id @default(uuid())
  checklistId       String
  checklist         Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  
  title             String
  completed         Boolean   @default(false)
  completedAt       DateTime?
  completedBy       String?
  
  createdAt         DateTime  @default(now())
}

model Timeline {
  id                String    @id @default(uuid())
  orgId             String
  leadId            String    @unique
  lead              Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  contactId         String
  contact           Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  // Events (JSON array - flexible structure)
  events            TimelineEvent[]
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([leadId])
  @@index([contactId])
}

model TimelineEvent {
  id                String    @id @default(uuid())
  timelineId        String
  timeline          Timeline  @relation(fields: [timelineId], references: [id], onDelete: Cascade)
  
  type              String    // lead_created, stage_changed, contacted, note_added, quote_sent, etc.
  title             String
  description       String?
  
  // Event-specific data
  metadata          Json?     // { oldStage, newStage, contactMethod, etc. }
  
  // Who and when
  createdBy         String
  createdAt         DateTime  @default(now())
  
  @@index([timelineId, type])
}

model Activity {
  id                String    @id @default(uuid())
  orgId             String
  leadId            String
  lead              Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  type              String    // call, email, meeting, note, task
  title             String
  description       String?
  
  // Scheduling
  scheduledFor      DateTime?
  duration          Int?      // minutes
  
  // Status
  status            String    @default("pending") // pending, completed, cancelled
  completedAt       DateTime?
  
  // Metadata
  metadata          Json?     // { phone, emailTo, meetingLink, etc. }
  
  // Creator and timestamp
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([leadId])
  @@index([type])
  @@index([scheduledFor])
}

model Quote {
  id                String    @id @default(uuid())
  orgId             String
  leadId            String
  lead              Lead      @relation(fields: [leadId], references: [id], onDelete: Restrict)
  
  quoteNumber       String    @unique // QT-2026-001
  
  // Products (to be detailed in phase 2)
  items             Json      // Array of { productId, quantity, price, discount }
  
  totalAmount       Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2) @default(0)
  finalAmount       Decimal   @db.Decimal(12, 2)
  
  // Validity
  validUntil        DateTime
  
  // Status
  status            String    @default("draft") // draft, sent, accepted, rejected, expired
  sentAt            DateTime?
  acceptedAt        DateTime?
  
  // Notes
  terms             String?   // Payment terms, delivery, etc.
  notes             String?
  
  // Creator
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([leadId])
  @@index([status])
}

model PurchaseRequest {
  id                String    @id @default(uuid())
  orgId             String
  leadId            String
  lead              Lead      @relation(fields: [leadId], references: [id], onDelete: Restrict)
  
  prNumber          String    @unique // PR-2026-001
  
  // Request details
  productIds        String[]  // Array of product IDs required
  estimatedQuantity Int
  estimatedAmount   Decimal   @db.Decimal(12, 2)
  
  // Status
  status            String    @default("pending") // pending, sent_to_supplier, received, approved
  sentToSupplierAt  DateTime?
  
  // Notes
  notes             String?
  
  // Creator
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([leadId])
  @@index([status])
}
```

### 2.2 API Endpoints - Phase 1

#### Leads API
```
GET    /api/v1/leads                    - List leads with filters
GET    /api/v1/leads/dashboard          - Dashboard metrics
GET    /api/v1/leads/:id                - Get single lead
POST   /api/v1/leads                    - Create new lead
PUT    /api/v1/leads/:id                - Update lead
PUT    /api/v1/leads/:id/stage          - Change lead stage (workflow enforcement)
PUT    /api/v1/leads/:id/assign         - Assign lead to user
DELETE /api/v1/leads/:id                - Delete lead (soft delete)

POST   /api/v1/leads/:id/activities     - Add activity (call, email, note)
GET    /api/v1/leads/:id/timeline       - Get lead timeline
GET    /api/v1/leads/:id/checklists     - Get lead checklists
```

#### Contacts API
```
GET    /api/v1/contacts                 - List contacts
GET    /api/v1/contacts/:id             - Get contact
POST   /api/v1/contacts                 - Create contact
PUT    /api/v1/contacts/:id             - Update contact
```

#### Quotes API
```
POST   /api/v1/leads/:id/quotes         - Create quote
GET    /api/v1/leads/:id/quotes         - List quotes for lead
GET    /api/v1/quotes/:quoteId          - Get quote details
PUT    /api/v1/quotes/:quoteId          - Update quote
PUT    /api/v1/quotes/:quoteId/send     - Send quote (trigger email)
PUT    /api/v1/quotes/:quoteId/accept   - Mark quote as accepted
```

#### Purchase Requests API
```
POST   /api/v1/leads/:id/purchase-requests - Create PR
GET    /api/v1/leads/:id/purchase-requests - List PRs
PUT    /api/v1/purchase-requests/:prId    - Update PR status
```

#### Checklists API
```
POST   /api/v1/leads/:id/checklists       - Create checklist
GET    /api/v1/leads/:id/checklists       - Get checklists
PUT    /api/v1/checklists/:checklistId/items/:itemId - Check item
```

### 2.3 Workflow Engine & SLA

#### Workflow State Machine
```typescript
// lib/workflow.ts

interface WorkflowState {
  name: string
  allowedTransitions: string[]
  requiredChecklists: string[]
  slaHours: number
}

const WORKFLOW_STATES: Record<string, WorkflowState> = {
  'New Lead': {
    name: 'New Lead',
    allowedTransitions: ['Contacted', 'Disqualified'],
    requiredChecklists: ['Initial Qualification'],
    slaHours: 24
  },
  'Contacted': {
    name: 'Contacted',
    allowedTransitions: ['Qualified', 'Deal Lost', 'Disqualified'],
    requiredChecklists: [],
    slaHours: 48
  },
  'Qualified': {
    name: 'Qualified',
    allowedTransitions: ['Quote Sent', 'Deal Lost', 'Disqualified'],
    requiredChecklists: ['Technical Assessment', 'Budget Confirmation'],
    slaHours: 72
  },
  'Quote Sent': {
    name: 'Quote Sent',
    allowedTransitions: ['Closed Won', 'Deal Lost', 'Qualified'],
    requiredChecklists: [],
    slaHours: 96
  },
  'Closed Won': {
    name: 'Closed Won',
    allowedTransitions: [],
    requiredChecklists: [],
    slaHours: 0
  },
  'Deal Lost': {
    name: 'Deal Lost',
    allowedTransitions: [],
    requiredChecklists: [],
    slaHours: 0
  },
  'Disqualified': {
    name: 'Disqualified',
    allowedTransitions: [],
    requiredChecklists: [],
    slaHours: 0
  }
}

export async function canTransitionStage(
  leadId: string,
  currentStage: string,
  newStage: string
): Promise<{
  allowed: boolean
  reason?: string
  blockedChecklists?: string[]
}> {
  // 1. Check if transition is allowed
  const state = WORKFLOW_STATES[currentStage]
  if (!state.allowedTransitions.includes(newStage)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStage} to ${newStage}`
    }
  }

  // 2. Check if all required checklists are completed
  const newState = WORKFLOW_STATES[newStage]
  if (newState.requiredChecklists.length > 0) {
    const incompleteChecklists = await prisma.checklist.findMany({
      where: {
        leadId,
        title: { in: newState.requiredChecklists },
        completedAt: null
      }
    })

    if (incompleteChecklists.length > 0) {
      return {
        allowed: false,
        reason: 'Required checklists must be completed before transitioning',
        blockedChecklists: incompleteChecklists.map(c => c.title)
      }
    }
  }

  return { allowed: true }
}

export function calculateSLADeadline(stage: string, createdAt: Date): Date {
  const state = WORKFLOW_STATES[stage]
  const deadline = new Date(createdAt)
  deadline.setHours(deadline.getHours() + state.slaHours)
  return deadline
}

export function checkSLABreach(slaDeadline: Date): boolean {
  return new Date() > slaDeadline
}
```

#### SLA Dashboard Widget
```typescript
// components/leads/SLAWidget.tsx

export function SLAWidget({ lead }: { lead: Lead }) {
  const now = new Date()
  const timeRemaining = lead.slaDeadline.getTime() - now.getTime()
  const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60))
  const breached = timeRemaining < 0

  const getColor = () => {
    if (breached) return 'red'
    if (hoursRemaining < 4) return 'orange'
    return 'green'
  }

  return (
    <div className={`sla-widget color-${getColor()}`}>
      <span className="sla-label">SLA due in</span>
      <span className="sla-time">
        {breached ? `${Math.abs(hoursRemaining)} hours overdue` : `${hoursRemaining} hours`}
      </span>
    </div>
  )
}
```

### 2.4 Frontend Components - Phase 1

#### Leads Dashboard
```typescript
// app/dashboard/page.tsx
// - Metrics cards (Total, Open, Hot, Won)
// - Stage tabs (All, New Lead, Contacted, etc.)
// - Search bar
// - Filter controls (date range, priority, assignee)
// - Bulk actions (assign, export)
// - Create New Lead button
```

#### Leads Table
```typescript
// components/leads/LeadsTable.tsx
// - TanStack Table for virtualization (efficient with large datasets)
// - Sortable columns (Stage, Priority, Created Date)
// - Filterable (Priority, Assigned to, Source)
// - Selectable rows (checkboxes for bulk actions)
// - Row context menu (view, edit, delete, assign, change stage)
// - SLA indicators (visual badges)
// - Last activity timestamp
```

#### Lead Detail View
```typescript
// app/leads/[id]/page.tsx
// - Contact info
// - Timeline (all activities and status changes)
// - Stage selector with validation
// - Checklists (with completion tracking)
// - Activities section (calls, emails, notes)
// - Quotes section (list with status badges)
// - Purchase requests section
// - Assignment selector
// - Custom fields editor
// - Delete/Disqualify options
```

#### Activity Forms
```typescript
// components/leads/AddActivityForm.tsx
// Types: Call, Email, Note, Meeting

// Call: duration, notes, outcome
// Email: recipient, subject, body, sent timestamp
// Note: content, visibility (private/team)
// Meeting: date, duration, attendees, notes
```

### 2.5 Data Validation - Phase 1

#### Zod Schemas
```typescript
// lib/validation.ts

export const CreateLeadSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[0-9\-\s()]+$/, 'Invalid phone'),
  companyName: z.string().min(1),
  source: z.enum(['Website', 'LinkedIn', 'Referral', 'Email', 'Other']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  notes: z.string().optional()
})

export const UpdateLeadStageSchema = z.object({
  stage: z.enum(['New Lead', 'Contacted', 'Qualified', 'Quote Sent', 'Closed Won', 'Deal Lost', 'Disqualified']),
  reason: z.string().optional() // For "Deal Lost" and "Disqualified"
})

export const CreateActivitySchema = z.object({
  type: z.enum(['call', 'email', 'note', 'meeting']),
  title: z.string(),
  description: z.string().optional(),
  scheduledFor: z.date().optional(),
  metadata: z.record(z.any()).optional()
})

export const CreateQuoteSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive(),
    discount: z.number().nonnegative().default(0)
  })),
  validUntil: z.date(),
  terms: z.string().optional(),
  notes: z.string().optional()
})
```

### 2.6 Testing Strategy - Phase 1

#### Unit Tests
- Workflow state machine logic
- SLA calculation and breach detection
- Permission checks for lead operations
- Form validation schemas

#### Integration Tests
- Lead creation flow (create contact + lead)
- Stage transition with checklist blocking
- Activity creation and timeline updates
- Quote creation and sending

#### E2E Tests
- Create lead from scratch
- Transition through workflow stages
- Add activities and check timeline
- Generate and send quote
- Assign to team member

**Coverage Target:** 70% for business logic, 50% for components

### 2.7 Performance Optimization - Phase 1

#### Database
- Indexes on frequently queried fields (orgId, stage, assignedTo, createdAt)
- Pagination for lists (limit 20-50 per page)
- Lazy loading of relations (timeline, activities)

#### Frontend
- Virtual scrolling in leads table (TanStack Table)
- Image lazy loading
- Code splitting per route
- Memoization of expensive components

#### Caching
- Redis for SLA calculations (30-minute TTL)
- Browser cache for static assets
- Stale-while-revalidate for lead lists

### 2.8 Deployment & Documentation - Phase 1

- [ ] Phase 1 API fully documented (OpenAPI/Swagger)
- [ ] E2E tests passing (>90%)
- [ ] Performance benchmarks: <200ms for lead list, <500ms for quote generation
- [ ] Staging deployment complete
- [ ] User documentation (CRM workflows, how to use dashboard)

---

## PHASE 2: Trading ERP (Week 9-16)

### Overview
Build purchase orders, sales orders, inventory management, dispatch, and invoicing.

### 3.1 Extended Database Schema

#### Product & Supplier Models
```
model Product {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Product info
  sku               String    @unique
  name              String    // Steel pipes, HR coils, etc.
  category          String    // Mild Steel Pipes, Hollow Sections, etc.
  
  // Specifications
  specifications    Json      // { size, grade, thickness, weight, etc. }
  
  // Pricing
  basePrice         Decimal   @db.Decimal(12, 2)
  currency          String    @default("INR")
  
  // Inventory
  currentStock      Int       @default(0)
  minStock          Int       @default(10)
  maxStock          Int       @default(1000)
  unit              String    // kg, piece, meter, ton
  
  // Sourcing
  defaultSupplier   String?   @relation("defaultSupplierOf", fields: [defaultSupplierId], references: [id])
  defaultSupplierId String?
  
  // Status
  active            Boolean   @default(true)
  discontinued      Boolean   @default(false)
  
  // Images & docs
  imageUrl          String?
  datasheet         String?   // File URL to technical specifications
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  quoteItems        Json[]    // Denormalized for performance
  stockMovements    StockMovement[]
  suppliers         Supplier[]
  salesOrders       SalesOrderItem[]
  purchaseOrders    PurchaseOrderItem[]
  
  @@index([orgId, active])
  @@index([category])
}

model Supplier {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Company info
  name              String
  contactPerson     String
  email             String
  phone             String
  
  // Address
  address           String
  city              String
  state             String
  pincode           String
  
  // Business details
  gstNumber         String    // For Indian suppliers
  bankAccount       Json?     // { accountNumber, ifsc, accountHolder }
  paymentTerms      String?   // COD, 30 days, etc.
  
  // Relationship
  products          Product[]
  purchaseOrders    PurchaseOrder[]
  rating            Decimal   @db.Decimal(3, 2) @default(0) // 0-5
  
  // Status
  active            Boolean   @default(true)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([orgId, active])
}

model Customer {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Company info
  name              String
  contactPerson     String
  email             String
  phone             String
  
  // Address
  address           String
  city              String
  state             String
  pincode           String
  
  // Business details
  gstNumber         String?
  bankAccount       Json?
  creditLimit       Decimal   @db.Decimal(12, 2) @default(0)
  
  // Customer type
  type              String    @default("dealer") // dealer, fabricator, contractor, manufacturer
  
  // Relations
  salesOrders       SalesOrder[]
  invoices          Invoice[]
  payments          Payment[]
  
  // Status
  active            Boolean   @default(true)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([orgId, active])
  @@index([type])
}

model SalesOrder {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Order details
  soNumber          String    @unique // SO-2026-001
  customerId        String
  customer          Customer  @relation(fields: [customerId], references: [id])
  
  // Items
  items             SalesOrderItem[]
  
  // Pricing
  subtotal          Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2) @default(0)
  tax               Decimal   @db.Decimal(12, 2)
  totalAmount       Decimal   @db.Decimal(12, 2)
  
  // Delivery
  deliveryAddress   String
  deliveryDate      DateTime
  
  // Payment
  paymentTerms      String?
  
  // Status
  status            String    @default("draft") // draft, confirmed, shipped, delivered, cancelled
  
  // Timeline
  confirmedAt       DateTime?
  shippedAt         DateTime?
  deliveredAt       DateTime?
  
  // Notes
  notes             String?
  specialInstructions String?
  
  // Tracking
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  shipments         Shipment[]
  invoice           Invoice?
  
  @@index([customerId])
  @@index([status])
}

model SalesOrderItem {
  id                String    @id @default(uuid())
  soId              String
  so                SalesOrder @relation(fields: [soId], references: [id], onDelete: Cascade)
  
  productId         String
  product           Product   @relation(fields: [productId], references: [id])
  
  quantity          Int
  unitPrice         Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2) @default(0)
  tax               Decimal   @db.Decimal(12, 2)
  totalPrice        Decimal   @db.Decimal(12, 2)
  
  // Delivery tracking
  delivered         Int       @default(0) // Quantity delivered
  pending           Int       // Calculated field
  
  createdAt         DateTime  @default(now())
}

model PurchaseOrder {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Order details
  poNumber          String    @unique // PO-2026-001
  supplierId        String
  supplier          Supplier  @relation(fields: [supplierId], references: [id])
  
  // Items
  items             PurchaseOrderItem[]
  
  // Pricing
  subtotal          Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2) @default(0)
  tax               Decimal   @db.Decimal(12, 2)
  totalAmount       Decimal   @db.Decimal(12, 2)
  
  // Delivery
  expectedDelivery  DateTime
  
  // Payment
  paymentTerms      String?
  
  // Status
  status            String    @default("draft") // draft, sent, confirmed, received, cancelled
  
  // Timeline
  sentAt            DateTime?
  confirmedAt       DateTime?
  receivedAt        DateTime?
  
  // Notes
  notes             String?
  
  // Tracking
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  goodsReceipts     GoodsReceipt[]
  
  @@index([supplierId])
  @@index([status])
}

model PurchaseOrderItem {
  id                String    @id @default(uuid())
  poId              String
  po                PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  
  productId         String
  product           Product   @relation(fields: [productId], references: [id])
  
  quantity          Int
  unitPrice         Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2) @default(0)
  tax               Decimal   @db.Decimal(12, 2)
  totalPrice        Decimal   @db.Decimal(12, 2)
  
  // Receiving
  received          Int       @default(0)
  pending           Int       // Calculated
  
  createdAt         DateTime  @default(now())
}

model GoodsReceipt {
  id                String    @id @default(uuid())
  orgId             String
  poId              String
  po                PurchaseOrder @relation(fields: [poId], references: [id])
  
  grNumber          String    @unique // GR-2026-001
  
  // Items received
  items             Json      // { productId, quantityReceived, qualityNotes }
  
  // Location
  warehouseLocation String?
  
  // Inspection
  inspectionDate    DateTime
  inspectionNotes   String?
  qualityStatus     String    // Accepted, Rejected, Partial
  
  // Timeline
  receivedAt        DateTime  @default(now())
  createdBy         String
  
  @@index([poId])
}

model Inventory {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  productId         String    @unique
  product           Product   @relation(fields: [productId], references: [id])
  
  // Stock levels
  currentStock      Int       @default(0)
  reserved          Int       @default(0) // For pending sales orders
  available         Int       // Calculated: currentStock - reserved
  
  // Locations
  warehouseLocations Json    // { location, quantity }
  
  // Reorder
  lastRestockDate   DateTime?
  nextRestockDate   DateTime?
  
  updatedAt         DateTime  @updatedAt
  
  @@index([orgId])
}

model StockMovement {
  id                String    @id @default(uuid())
  orgId             String
  productId         String
  product           Product   @relation(fields: [productId], references: [id])
  
  type              String    // inbound, outbound, adjustment, return
  quantity          Int
  
  // Reference
  reference         String    // SO-001, PO-001, GR-001
  referenceType     String    // sales_order, purchase_order, goods_receipt
  
  notes             String?
  
  createdBy         String
  createdAt         DateTime  @default(now())
  
  @@index([productId])
  @@index([type])
}

model Shipment {
  id                String    @id @default(uuid())
  orgId             String
  soId              String
  so                SalesOrder @relation(fields: [soId], references: [id])
  
  shipmentNumber    String    @unique // SHIP-2026-001
  
  // Items
  items             Json      // { soItemId, quantityShipped }
  
  // Logistics
  shippingProvider  String?   // Fedex, Delhivery, etc.
  trackingNumber    String?
  
  // Dates
  shippedAt         DateTime
  expectedDelivery  DateTime
  
  // Status
  status            String    @default("in_transit") // in_transit, delivered, failed
  deliveredAt       DateTime?
  
  // Delivery address
  deliveryAddress   String
  
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([soId])
  @@index([status])
}

model Invoice {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // Invoice details
  invoiceNumber     String    @unique // INV-2026-001
  customerId        String
  customer          Customer  @relation(fields: [customerId], references: [id])
  
  soId              String    @unique
  so                SalesOrder @relation(fields: [soId], references: [id])
  
  // Dates
  invoiceDate       DateTime  @default(now())
  dueDate           DateTime
  
  // Amount
  subtotal          Decimal   @db.Decimal(12, 2)
  discount          Decimal   @db.Decimal(12, 2)
  tax               Decimal   @db.Decimal(12, 2)
  totalAmount       Decimal   @db.Decimal(12, 2)
  
  // Payment
  paidAmount        Decimal   @db.Decimal(12, 2) @default(0)
  outstandingAmount Decimal   @db.Decimal(12, 2)
  
  // Status
  status            String    @default("issued") // issued, partial_paid, fully_paid, overdue, written_off
  
  // Notes
  notes             String?
  terms             String?
  
  // Timeline
  paidAt            DateTime?
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  payments          Payment[]
  
  @@index([customerId])
  @@index([status])
  @@index([dueDate])
}

model Payment {
  id                String    @id @default(uuid())
  orgId             String
  invoiceId         String
  invoice           Invoice   @relation(fields: [invoiceId], references: [id])
  
  customerId        String
  customer          Customer  @relation(fields: [customerId], references: [id])
  
  // Payment details
  amount            Decimal   @db.Decimal(12, 2)
  paymentMethod     String    // upi, bank_transfer, cheque, cash
  transactionId     String?   // For UPI/Bank transfers
  referenceNumber   String?   // Cheque number
  
  // Status
  status            String    @default("completed") // completed, pending, failed
  
  // Dates
  paymentDate       DateTime  @default(now())
  processedAt       DateTime?
  
  notes             String?
  
  createdBy         String
  createdAt         DateTime  @default(now())
  
  @@index([invoiceId])
  @@index([customerId])
}

model Outstanding {
  id                String    @id @default(uuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  customerId        String
  invoiceId         String
  
  amount            Decimal   @db.Decimal(12, 2)
  dueDate           DateTime
  
  // Status
  status            String    @default("open") // open, partially_paid, overdue, written_off
  daysOverdue       Int       // Calculated
  
  // Follow-up
  lastReminderDate  DateTime?
  reminderCount     Int       @default(0)
  
  notes             String?
  
  updatedAt         DateTime  @updatedAt
  
  @@index([customerId])
  @@index([status])
}
```

### 3.2 Sales Order & Purchase Order Workflows

#### Sales Order Flow
```
Draft → Confirmed → Shipped → Delivered → Invoiced

- Validations:
  - Customer must exist and be active
  - Products must exist and have sufficient inventory
  - Delivery date must be in future
  - Create stock reservation on confirmation
```

#### Purchase Order Flow
```
Draft → Sent → Confirmed → Received → Paid

- Supplier must exist
- Products must exist
- Expected delivery must be in future
- Update inventory on goods receipt
```

#### Inventory Management
```typescript
// When sales order is confirmed:
- Reserve stock for each item
- Check if reserved + current pending > available

// When shipment is created:
- Deduct from current stock
- Update shipment status

// When goods receipt is created:
- Add to current stock from PO
- Update supplier quality metrics

// Real-time balance:
Available = CurrentStock - Reserved
```

### 3.3 Invoicing & Outstanding Management

#### Invoice Lifecycle
```
Issued → Partially Paid → Fully Paid / Overdue → Written Off

Auto-calculations:
- OutstandingAmount = TotalAmount - PaidAmount
- DaysOverdue = Today - DueDate (if > 0)
- Status depends on: OutstandingAmount and DaysOverdue
```

#### Reports for Phase 2
- Sales order register (with delivery status)
- Purchase order register (with receipt status)
- Inventory report (current stock, movement, valuation)
- Invoice aging (outstanding > 30, 60, 90 days)
- Outstanding report (customer-wise)
- Dispatch report (shipments and tracking)

### 3.4 API Endpoints - Phase 2

```
# Sales Orders
POST   /api/v1/sales-orders
GET    /api/v1/sales-orders
GET    /api/v1/sales-orders/:soId
PUT    /api/v1/sales-orders/:soId
PUT    /api/v1/sales-orders/:soId/confirm
POST   /api/v1/sales-orders/:soId/shipments

# Purchase Orders
POST   /api/v1/purchase-orders
GET    /api/v1/purchase-orders
PUT    /api/v1/purchase-orders/:poId
PUT    /api/v1/purchase-orders/:poId/send
POST   /api/v1/purchase-orders/:poId/goods-receipts

# Inventory
GET    /api/v1/inventory
GET    /api/v1/inventory/:productId
PUT    /api/v1/inventory/:productId/adjust

# Invoices
GET    /api/v1/invoices
POST   /api/v1/sales-orders/:soId/invoice
PUT    /api/v1/invoices/:invoiceId
POST   /api/v1/invoices/:invoiceId/payments
GET    /api/v1/invoices/:invoiceId/payments

# Customers & Suppliers
POST   /api/v1/customers
GET    /api/v1/customers
POST   /api/v1/suppliers
GET    /api/v1/suppliers

# Reports
GET    /api/v1/reports/sales-register
GET    /api/v1/reports/purchase-register
GET    /api/v1/reports/invoice-aging
GET    /api/v1/reports/outstanding
GET    /api/v1/reports/inventory-valuation
```

### 3.5 Frontend Dashboards - Phase 2

- **Sales Dashboard:** Pipeline value, delivery status, invoice status
- **Purchase Dashboard:** PO status, supplier performance, goods receipt pending
- **Inventory Dashboard:** Stock levels, slow-moving products, reorder alerts
- **Outstanding Dashboard:** Aging analysis, follow-up reminders, payment patterns

### 3.6 Testing & Performance - Phase 2

#### Load Testing
- Simulate 10,000 leads, 5,000 sales orders, 3,000 purchase orders
- Stress test: List operations with filters
- Performance target: <500ms for complex reports

#### Integration Tests
- Complete sales order → shipment → invoice → payment flow
- Inventory reservation and deduction
- Outstanding aging calculation

### 3.7 Deployment - Phase 2

- [ ] All ERP endpoints tested
- [ ] Report generation optimized (pre-calculation with Redis)
- [ ] Email notifications configured (Resend for invoices, reminders)
- [ ] PDF generation tested (jsPDF or similar for invoices)
- [ ] Staging data cleaned up

---

## PHASE 3: Accounts, AI, Automation & Analytics (Week 17-24)

### Overview
Advanced features: financial accounting, AI-powered insights, workflow automation, and comprehensive analytics.

### 4.1 Accounting Module

#### General Ledger
```
model Account {
  id                String    @id @default(uuid())
  code              String    @unique // 1000, 2000, 3000 (asset, liability, equity, revenue, expense)
  name              String
  accountType       String    // Asset, Liability, Equity, Revenue, Expense
  subType           String?   // Current Asset, Fixed Asset, etc.
  description       String?
  
  // Balance tracking
  openingBalance    Decimal   @db.Decimal(12, 2) @default(0)
  closingBalance    Decimal   @db.Decimal(12, 2) @default(0)
  
  createdAt         DateTime  @default(now())
}

model JournalEntry {
  id                String    @id @default(uuid())
  orgId             String
  
  entryDate         DateTime
  description       String
  referenceType     String    // invoice, payment, manual_journal
  referenceId       String?
  
  // Debits and Credits
  entries           JournalLineItem[]
  
  status            String    @default("posted") // draft, posted, reversed
  
  approvedBy        String?
  approvedAt        DateTime?
  
  createdBy         String
  createdAt         DateTime  @default(now())
}

model JournalLineItem {
  id                String    @id @default(uuid())
  journalId         String
  journal           JournalEntry @relation(fields: [journalId], references: [id], onDelete: Cascade)
  
  accountId         String
  account           Account   @relation(fields: [accountId], references: [id])
  
  debit             Decimal   @db.Decimal(12, 2) @default(0)
  credit            Decimal   @db.Decimal(12, 2) @default(0)
  
  description       String?
}

// Auto-posting from invoices and payments
// Trigger on invoice issued:
// - Debit: Accounts Receivable (1100)
// - Credit: Revenue (4000)

// Trigger on payment received:
// - Debit: Bank/Cash (1010)
// - Credit: Accounts Receivable (1100)
```

#### Financial Reports
- **Trial Balance:** All accounts with debit/credit balances
- **P&L Statement:** Revenue - Expenses = Profit
- **Balance Sheet:** Assets = Liabilities + Equity
- **Cash Flow:** Inflows and outflows by period
- **GST Report:** Sales tax collected vs. paid (for India compliance)

### 4.2 AI-Powered Features

#### Lead Scoring
```typescript
// Predict lead quality based on:
// - Contact engagement (email opens, page views)
// - Historical patterns (similar leads that converted)
// - Lead data (company size, industry, budget hints)
// - Stage velocity (how fast they're moving through stages)

// Output: Score 0-100 + conversion probability
// Store in lead.aiScore, lead.conversionProbability

model LeadScoring {
  leadId            String    @unique
  score             Int       // 0-100
  conversionProbability Decimal @db.Decimal(3, 2) // 0-1.0
  factors           Json      // { engagement: 20, historical: 30, data: 25, velocity: 25 }
  lastCalculated    DateTime
}
```

#### Deal Health Monitoring
```typescript
// Red flags:
// - No activity for 7+ days
// - Stalled at same stage for >2 weeks
// - SLA breach
// - Overdue quote follow-up

// Green flags:
// - Regular activity
// - Quick stage progression
// - Multiple decision makers engaged

// Output: Health status (Healthy, At Risk, Critical)
// Send alerts to assigned rep
```

#### Email Insights
```typescript
// NLP analysis of:
// - Customer sentiment (positive, neutral, negative)
// - Action items from emails
// - Key decision criteria mentioned
// - Timeline signals ("ASAP", "next month")

// Store findings in lead.aiInsights
```

#### Recommendation Engine
```typescript
// Suggest to sales rep:
// - "This lead shows similar patterns to deals you won last quarter"
// - "Competitor X also interested in this segment"
// - "Suggest product Y based on company profile"
// - "Best time to follow up: Thursday afternoon based on response patterns"
```

### 4.3 Automation Workflows

#### Example Workflows
```
1. Auto-assignment:
   - Route new leads to sales rep based on: capacity, past performance, territory

2. Auto-follow-up:
   - If lead hasn't been contacted in 48 hours → Send reminder task
   - If quote sent but no response in 5 days → Auto-follow-up email

3. Auto-escalation:
   - If deal is hot but not assigned → Notify manager
   - If SLA breached → Escalate to supervisor

4. Auto-invoicing:
   - When SO confirmed → Auto-create draft invoice
   - On delivery confirmation → Auto-send invoice

5. Payment reminders:
   - 2 days before due date → Send payment reminder
   - On due date → Mark as overdue
   - After 15 days → Escalate to collection
```

#### Workflow Builder UI
```
Trigger (When) → Conditions (If) → Actions (Then)

Example:
  Trigger: Lead stage changed to "Quote Sent"
  Condition: Priority = "High" AND leadScore > 75
  Action: Notify manager, Create calendar reminder
```

### 4.4 Analytics & Reporting

#### Dashboards
```
1. Executive Dashboard:
   - Total revenue (YTD, MTD)
   - Deal pipeline value by stage
   - Win rate by rep
   - Customer acquisition cost
   - Forecast vs. actual

2. Sales Dashboard:
   - Personal pipeline
   - Activity metrics (calls, emails, meetings)
   - Conversion funnel (Leads → Won)
   - Deal aging (time in each stage)

3. Operations Dashboard:
   - Inventory turnover
   - Supplier performance (delivery, quality)
   - Order fulfillment rate
   - Logistics costs

4. Finance Dashboard:
   - Revenue recognition (monthly, quarterly)
   - Accounts receivable aging
   - Cash flow forecast
   - Expense breakdown
```

#### Key Metrics Calculated
```typescript
// Sales Metrics
- Win Rate = Closed Won / (Closed Won + Closed Lost)
- Sales Velocity = Revenue / Average Days in Pipeline
- Deal Size = Total Revenue / Total Deals
- Cost Per Lead = Marketing Spend / Number of Leads

// Customer Metrics
- Customer Lifetime Value = Total Revenue from Customer / Customer Lifetime
- Churn Rate = Customers Lost / Starting Customers
- Net Retention Rate = Revenue from Existing Customers / Previous Period Revenue

// Operational Metrics
- Inventory Turnover = COGS / Average Inventory Value
- Order Fulfillment Rate = Orders Delivered On Time / Total Orders
- Days Sales Outstanding (DSO) = (Accounts Receivable / Revenue) × Days

// Financial Metrics
- Gross Margin = (Revenue - COGS) / Revenue
- Operating Margin = Operating Income / Revenue
- Cash Conversion Cycle = DIO + DSO - DPO
```

### 4.5 API Endpoints - Phase 3

```
# Accounting
POST   /api/v1/accounts
GET    /api/v1/accounts
POST   /api/v1/journal-entries
GET    /api/v1/reports/trial-balance
GET    /api/v1/reports/profit-loss
GET    /api/v1/reports/balance-sheet

# AI & Insights
GET    /api/v1/leads/:id/ai-insights
GET    /api/v1/leads/:id/score-factors
GET    /api/v1/ai/recommendations

# Automation
POST   /api/v1/automations
GET    /api/v1/automations
PUT    /api/v1/automations/:id
GET    /api/v1/automation-logs

# Analytics
GET    /api/v1/analytics/sales
GET    /api/v1/analytics/operations
GET    /api/v1/analytics/finance
GET    /api/v1/dashboards/:dashboardId

# Webhooks
POST   /api/v1/webhooks
GET    /api/v1/webhooks
PUT    /api/v1/webhooks/:id
```

### 4.6 Integration Points

#### Email Integration
- Inbound: Parse emails to leads, extract action items
- Outbound: Track sent quotes, invoices as activities
- Link conversations to leads

#### Calendar Integration
- Sync scheduled activities with Google Calendar
- Add follow-up reminders
- Suggest best meeting times

#### Slack Integration
- Post alerts (deal updates, overdue invoices)
- Create leads from Slack messages
- Daily summary briefings

#### External APIs
- SMS for payment reminders (Twilio)
- Email campaigns (Mailchimp integration)
- Payment gateway (Razorpay for Indian context)

### 4.7 Performance & Scalability

#### Caching Strategy for Analytics
```typescript
// Pre-calculate metrics on schedule:
- Daily: Sales velocity, win rate, DSO
- Weekly: Revenue forecasts, customer segmentation
- Monthly: Financial statements, comprehensive reports

// Redis caching with 6-24 hour TTL
// Trigger recalculation on: new deal, new payment, period close
```

#### Database Optimization for Historical Data
```
- Archive old transactions (>2 years) to separate table
- Partition invoice table by year/month
- Materialized views for frequently accessed reports
```

#### Background Jobs
```
- Calculate AI scores (nightly)
- Generate forecasts (daily)
- Send automation actions (every 15 minutes)
- Calculate metrics (hourly)
- Generate reports (on-demand with queue)
```

### 4.8 Testing - Phase 3

- [ ] AI scoring model validation (accuracy > 80%)
- [ ] Automation workflow execution tests
- [ ] Financial report accuracy (matches manual calculations)
- [ ] Performance: Analytics dashboard load <1 second
- [ ] Integration tests with external APIs

### 4.9 Deployment Checklist - Phase 3

- [ ] All analytics queries optimized (query time < 2s)
- [ ] Background job queue configured (Bull/BullMQ)
- [ ] AI model deployed and monitored
- [ ] Email/SMS/Slack integrations tested
- [ ] Financial audit trail complete
- [ ] User training materials prepared
- [ ] Phase 3 documentation complete

---

## Summary: Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| **Phase 0** | Week 1-2 | Auth, Admin portal, API scaffold, DB schema |
| **Phase 1** | Week 3-8 | Leads management, Workflow engine, SLA tracking, CRM UI |
| **Phase 2** | Week 9-16 | Sales/Purchase orders, Inventory, Invoicing, Outstanding mgmt |
| **Phase 3** | Week 17-24 | Accounting, AI insights, Automation, Analytics, Integrations |

**Total Timeline:** ~6 months for v1.0 with team of 2-3 engineers

---

## Technical Debt & Future Considerations

1. **Multi-currency support:** Phase 4
2. **Multi-language:** Phase 4
3. **Advanced inventory:** Batch tracking, serial numbers, lot management
4. **Contract management:** Service agreements, SLAs with customers
5. **Mobile app:** Native iOS/Android for field sales
6. **API rate limiting:** Implement per-org/per-user rate limits
7. **Data encryption:** PII encryption at rest
8. **Compliance:** SOC 2, ISO 27001 certification path

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data loss | Daily automated backups, point-in-time recovery |
| Scalability bottleneck | Read replicas for reporting, caching layer |
| Performance degradation | Index optimization, query monitoring, alerting |
| Integration failures | Retry logic, fallback mechanisms, error tracking |
| Security breach | Rate limiting, input validation, security headers, audit logs |

---

## Success Metrics

- **Phase 0:** Zero authentication bugs, 100% uptime in staging
- **Phase 1:** CRM fully functional, 95% test coverage for core logic
- **Phase 2:** All orders processed correctly, invoice reconciliation perfect
- **Phase 3:** AI accuracy >80%, automation 99% uptime, analytics <2s load time
- **Overall:** <100ms API response time, 99.9% availability, zero data loss


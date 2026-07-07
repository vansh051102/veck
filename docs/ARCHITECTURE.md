# Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth (JWT) |
| UI | Tailwind CSS + shadcn/ui |
| Validation | Zod |
| Testing | Jest + Playwright (e2e) |

## Directory Structure

```
app/
  (app)/          # Authenticated app routes (dashboard, etc.)
  api/v1/         # REST API endpoints
  auth/           # Login / signup pages
components/       # Shared React components
  dashboard/      # Dashboard-specific components
  ui/             # shadcn/ui primitives
lib/              # Business logic, utilities
  rbac.ts         # Role-based access control
  lead-creation.ts
  use-current-user.ts
prisma/
  schema.prisma   # Database schema (single source of truth)
docs/             # Documentation
middleware.ts     # Auth + route protection
```

## Request Flow

```
Client → middleware.ts (auth check) → Next.js Route Handler → Prisma → Supabase DB
```

## Auth Model

- Supabase handles auth (signup, login, JWT issuance)
- JWT is passed as `Authorization: Bearer <token>` on API requests
- `middleware.ts` validates tokens and protects all `/app/*` and `/api/v1/*` routes
- RBAC permissions are stored in the database — see [RBAC.md](RBAC-IMPLEMENTATION-PLAN.md)

## API Convention

All API responses follow the shape defined in `lib/api-response.ts`:

```json
{ "success": true, "data": {...} }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

See [API.md](API.md) for full endpoint reference.

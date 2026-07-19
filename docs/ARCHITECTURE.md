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
- RBAC permissions are stored in the database — `lib/permissions.ts` defines the permission strings and role→permission map; `lib/rbac.ts` enforces them. (The original rollout plan is history: [archive/RBAC-IMPLEMENTATION-PLAN.md](archive/RBAC-IMPLEMENTATION-PLAN.md).)

## API Convention

All API responses follow the shape defined in `lib/api-response.ts`:

```json
{ "success": true, "data": {...} }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

See [API.md](API.md) for full endpoint reference.

## Core Dependencies

Chosen deliberately; each earns its place.

| Package | Why |
|---|---|
| `@prisma/client` | ORM. `prisma/schema.prisma` is the schema single source of truth |
| `@supabase/auth-helpers-nextjs`, `@supabase/supabase-js` | Auth + hosted Postgres |
| `zod` | Request validation; errors returned in `flatten()` shape |
| `pdf-lib` | Quote PDF generation (`lib/quote-pdf.ts`) — no headless browser needed |
| `resend` | Transactional email (SLA breach/warning notifications) |
| `pino` | Structured logging (`lib/logger.ts`) |
| `zustand` | Client state |
| `@tanstack/react-table` | Lead tables (sorting, pagination) |
| `react-hook-form` + `@hookform/resolvers` | Forms, wired to the same Zod schemas |
| `date-fns` | Date math, incl. business-hours SLA calculations |

## Lead Ingestion Flow

All external channels converge on one creation path, so dedup and assignment rules can't be bypassed
per-channel:

```
Marketplace (IndiaMart / TradeIndia / Email / WhatsApp)
  → POST /api/v1/webhooks/<channel>/<secret>
  → secret verified (lib/secure-compare.ts, constant-time)
  → rate limited (lib/rate-limit-db.ts)
  → payload validated (Zod schema in lib/validation.ts)
  → dedup on Lead.externalId
  → lib/lead-creation.ts: createLeadWithDefaults()
  → lib/auto-assign.ts: pickAssignee()
  → Lead + Contact + Timeline written
```

JustDial is the exception: it has no webhook, so `app/api/v1/cron/justdial-poll` **polls** its Lead
Manager API on a 20-minute lookback window and feeds the same path.

## Background Jobs

Three scheduled endpoints, each authenticated with `Authorization: Bearer $CRON_SECRET`:

- `api/v1/cron/sla-check` — breach/warning detection + notification dispatch
- `api/v1/cron/follow-up-nudges` — overdue follow-up nudges
- `api/v1/cron/justdial-poll` — JustDial ingestion

There is **no `vercel.json`** — schedules are configured externally (Vercel Cron UI or any scheduler).
`justdial-poll` must run more often than its 20-minute lookback or leads are missed.

## Multi-tenancy

Every tenant is an `Organization`. 56 of 62 `app/api/v1` routes are `orgId`-scoped; `middleware.ts`
injects `x-org-id` and `lib/ownership.ts` narrows queries further by role, department, and record
ownership.

## Known Architectural Debt

- **ERP module excluded from build.** The Phase 2 Trading ERP source is not compiled. Some forward
  helpers exist ahead of it (`lib/numbering.ts`: `nextSalesOrderNumber`, `nextInvoiceNumber`).
- **Schema vs. migration drift.** `TallySyncQueue` and the ERP ledger columns live in
  `prisma/migrations/20260709223455_erp_ledger_tally_conversion/` but not in `prisma/schema.prisma`.
  Read [database-migrations.md](database-migrations.md) before running any migration command —
  the baseline requires `prisma migrate resolve --applied 0_init` first.
- **Tally Bridge is a placeholder**, not an integration. See [../FEATURES.md](../FEATURES.md).

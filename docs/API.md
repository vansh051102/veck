# VECK API Reference (Phase 1)

Base path: `/api/v1`. All endpoints (except those marked **public**) require a Supabase session; the middleware resolves it and injects `x-user-id`, `x-org-id`, `x-user-role` into the request. All responses use the envelope:

```json
{ "success": true, "data": …, "pagination": …?, "meta": { "statusCode": 200, "timestamp": "…" } }
{ "success": false, "error": { "code": "…", "message": "…", "details": …? }, "meta": … }
```

Validation errors return `details` in Zod `flatten()` shape (`fieldErrors` per field).

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` | **public** — create org + first user |
| POST | `/auth/signin` | **public** |
| GET | `/auth/me` | Current user + org |

Password reset is client-side via Supabase (`/auth/forgot-password` page); there is deliberately no API route.

## Leads

| Method | Path | Notes |
|---|---|---|
| POST | `/leads` | Create lead. Auto-creates SOP Step 1 checklists, timeline, and (if enabled) auto-assigns. Body: `contactId`, `companyName`, `priority?`, `notes?`, `source?`, `tags?` |
| GET | `/leads` | List. Filters: `stage`, `priority`, `assignedToId`, `search`, `days` (7/30/90), `from`/`to` (ISO dates). Sort: `sortBy` (`createdAt`, `companyName`, `priority`, `stage`, `lastActivityAt`, `slaDeadline`) + `sortDir`. Paginated (`page`, `limit` ≤ 100) |
| GET | `/leads/stats` | Metric counts: `total`, `open`, `hot`, `wonThisMonth`, `slaBreached`, `byStage` |
| GET | `/leads/export` | CSV download; same filters as list; max 5000 rows |
| POST | `/leads/import` | Bulk import: `{ rows: [{ companyName, firstName, lastName, email, phone, priority?, source?, notes? }] }` (≤ 500). Upserts contacts by email; per-row error report |
| GET | `/leads/:id` | Full detail (contact, checklists, activities, timeline, quotes, PRs) |
| PUT | `/leads/:id` | Update fields (not stage/assignment) |
| DELETE | `/leads/:id` | Soft delete → Disqualified. **409 for terminal-stage leads** |
| PUT | `/leads/:id/stage` | Workflow transition. Body: `stage`, `reason?`. Gated by: legal transition, activity minimums, incomplete required checklists. Loss paths require a reason from the SOP `DEAL_LOST_REASONS` list. Entering a stage auto-creates its SOP checklists; entering Quote Sent schedules the 6-day follow-up |
| PUT | `/leads/:id/assign` | Body: `assignedToId` |
| POST/GET | `/leads/:id/activities` | Log / list activities (`call`, `email`, `note`, `meeting`, `task`; `scheduledFor`, `duration`, `metadata`) |
| POST/GET | `/leads/:id/checklists` | Add / list checklists (`title`, `isRequired`, `items[]`) |
| POST/GET | `/leads/:id/quotes` | Create (atomic `QT-YYYY-NNN` number) / list quotes |
| POST/GET | `/leads/:id/purchase-requests` | Create (`PR-YYYY-NNN`) / list |

## Other resources

| Method | Path | Notes |
|---|---|---|
| PUT | `/checklists/:id/items/:itemId` | Toggle item; parent checklist auto-completes when all items done |
| PUT/DELETE | `/activities/:id` | Update / delete activity |
| GET/POST | `/contacts` · GET/PUT `/contacts/:id` | Contact CRUD; unique per org by email |
| GET | `/users` | Org users (for assignment pickers) |
| PUT | `/quotes/:id` · POST `/quotes/:id/send` | Update quote / send (body: `recipientEmail`) |
| PUT | `/purchase-requests/:id` | Update status |
| GET/PUT | `/settings` | Org settings. PUT is **admin only**: `autoAssignmentEnabled`, `slaDefaultHours`, `slaWarningHours`, `emailNotificationsEnabled` |
| GET | `/health` | **public** |

## Server-to-server

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cron/sla-check` | `Authorization: Bearer <CRON_SECRET>` | Flags `slaBreached` on open leads past deadline. Idempotent |
| GET | `/cron/follow-up-nudges` | same | Posts timeline "overdue" events for missed Quote Sent follow-ups; cancels follow-ups on leads that left Quote Sent |
| POST | `/webhooks/indiamart/:secret` | URL secret | IndiaMART Push API lead ingestion (idempotent via `externalId`) |

## Workflow rules (enforced server-side)

Stages: `New Lead → Contacted → Qualified → Quote Sent → Closed Won`; any active stage → `Deal Lost` / `Disqualified` (terminal, immutable).

- Leaving **New Lead** requires ≥ 1 activity; leaving **Contacted** requires ≥ 3 total.
- Any incomplete checklist with `isRequired: true` blocks forward transitions.
- Loss transitions require a reason from `DEAL_LOST_REASONS` (`lib/lead-stages.ts`).
- SLA windows: New Lead 1h · Contacted 24h · Qualified 3h · Quote Sent 6d.

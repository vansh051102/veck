# VECK API Reference

Complete reference for all 62 route handlers under `/api/v1`.

All endpoints except those marked **public** require a Supabase session. `middleware.ts` resolves it
and injects `x-user-id`, `x-org-id` and `x-user-role`; the handler then enforces a specific permission
via `requirePermission()` (see `lib/permissions.ts`). Every response uses one envelope:

```json
{ "success": true, "data": …, "pagination": …?, "meta": { "statusCode": 200, "timestamp": "…" } }
{ "success": false, "error": { "code": "…", "message": "…", "details": …? }, "meta": … }
```

Validation errors return `details` in Zod `flatten()` shape (`fieldErrors` per field).

## Error codes

Thrown from `lib/errors.ts`; any endpoint can return these.

| Code | Status | Raised when |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body or query fails its Zod schema, or a workflow rule rejects the change |
| `UNAUTHORIZED` | 401 | No valid session, or a bad `CRON_SECRET` / webhook secret |
| `FORBIDDEN` | 403 | Authenticated but the role lacks the required permission |
| `NOT_FOUND` | 404 | Record missing, or outside the caller's org / ownership scope |
| `CONFLICT` | 409 | State collision — e.g. moving a lead to the stage it is already in |
| `RATE_LIMIT_EXCEEDED` | 429 | Webhook rate limiter tripped (`lib/rate-limit-db.ts`) |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled failure; logged via `pino` |

**Ownership scoping.** `LEADS_READ` grants access to the *set of leads the role may see*, not all of
them — `lib/ownership.ts` narrows every list query by role, department and assignment, so two users
with identical permissions can receive different rows. A record outside scope returns `404`, not
`403`, so existence isn't leaked.

---

## Auth

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/signup` | **public** | `SignUpSchema` | Creates the org, its first admin, and seeds roles (`lib/seed-roles.ts`) |
| POST | `/auth/signin` | **public** | `SignInSchema` | Returns the Supabase session |
| GET | `/auth/me` | session only | — | Current user with role and resolved permissions |
| GET | `/internal/session` | session only | — | Internal session resolution used by the client |

## Leads

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| GET | `/leads` | `LEADS_READ` | — | Paginated. Filters: `stage`, `priority`, `assignedToId`, `search`, date range. Ownership-scoped |
| POST | `/leads` | `LEADS_CREATE` | `CreateLeadSchema` | Routes through `lib/lead-creation.ts`, so dedup and auto-assign apply |
| GET | `/leads/:id` | `LEADS_READ` | — | Lead with contact, assignee, activities (50), timeline (30), quotes (20). **Excludes checklists and purchase requests** — deliberately, to keep the payload bounded. Fetch those from their own endpoints |
| PUT | `/leads/:id` | `LEADS_EDIT` | `UpdateLeadSchema` | Field updates. Stage changes must use `/leads/:id/stage` |
| DELETE | `/leads/:id` | `LEADS_DELETE` | — | — |
| PUT | `/leads/:id/stage` | `LEADS_EDIT` | `UpdateLeadStageSchema` | See **Stage transitions** below |
| PUT | `/leads/:id/assign` | `LEADS_ASSIGN` | `AssignLeadSchema` | — |
| GET | `/leads/:id/timeline` | `LEADS_READ` | — | Full event history |
| GET | `/leads/:id/activities` | `ACTIVITIES_READ` | — | — |
| POST | `/leads/:id/activities` | `ACTIVITIES_CREATE` | `CreateActivitySchema` | Calls, notes, tasks |
| GET | `/leads/:id/checklists` | `CHECKLISTS_READ` | — | SOP checklists for the lead's stage |
| POST | `/leads/:id/checklists` | `CHECKLISTS_CREATE` | `CreateChecklistSchema` | — |
| GET | `/leads/:id/documents` | `LEADS_READ` | — | — |
| POST | `/leads/:id/documents` | `LEADS_EDIT` | multipart | — |
| DELETE | `/leads/:id/documents/:docId` | `LEADS_EDIT` | — | — |
| GET | `/leads/:id/quotes` | `QUOTES_READ` | — | — |
| POST | `/leads/:id/quotes` | `QUOTES_CREATE` | `CreateQuoteSchema` | Number assigned by `lib/numbering.ts` |
| GET | `/leads/:id/purchase-requests` | `PURCHASE_REQUESTS_READ` | — | — |
| POST | `/leads/:id/purchase-requests` | `PURCHASE_REQUESTS_CREATE` | `CreatePurchaseRequestSchema` | — |
| PUT | `/leads/bulk` | `LEADS_EDIT`, `LEADS_ASSIGN` | `BulkUpdateSchema` | Bulk stage or assignee change |
| GET | `/leads/stats` | session only | — | Dashboard KPI counts, ownership-scoped |
| GET | `/leads/export` | `LEADS_EXPORT` | — | CSV. Applies the role's `maskPiiData` (masks all but the last 4 chars of email/phone/GST) and `maxExportLimitDaily`. Admins bypass both |
| POST | `/leads/import` | `LEADS_IMPORT` | `ImportSchema` / `ImportRowSchema` | Per-row validation; invalid rows are reported while valid rows still import |

### Stage transitions

`PUT /leads/:id/stage` is the only way to move a lead. Enforced in `lib/workflow.ts`:

- Moving to the current stage → `409 CONFLICT`.
- **Role gates:** only Purchase may move `Qualified → Quote Sent`; Marketing cannot enter `Quote Sent`.
- **Loss reasons:** `Deal Lost` / `Disqualified` require `reason` from the controlled list in
  `lib/lead-stages.ts`. Free text is rejected so loss analytics stay queryable; `reasonDetails`
  captures specifics.
- **Handover:** Marketing must supply `assignedToId` when moving to `Qualified`.
- **SOP gate:** required checklists for the current stage must be complete.
- **Sequence is guidance, not a gate.** Any role may skip stages, and terminal leads can be reopened.
  An out-of-sequence move (`isOutOfSequence()`) requires a `reason` and is recorded rather than
  blocked: the timeline entry is prefixed `⚠ Skipped sequence`, and both the timeline metadata and the
  `STAGE_CHANGE` audit entry carry `outOfSequence` and `flaggedDisqualify` flags for admin review.

Stages: `New Lead → Contacted → Qualified → Quote Sent → Order Confirmed → Order Closed`, with
`Deal Lost` / `Disqualified` reachable from any active stage. `Closed Won` is a legacy alias
normalized to `Order Confirmed` on read.

## Contacts

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/contacts` | `CONTACTS_READ` | — |
| POST | `/contacts` | `CONTACTS_CREATE` | `CreateContactSchema` |
| GET | `/contacts/:id` | `CONTACTS_READ` | — |
| PUT | `/contacts/:id` | `CONTACTS_EDIT` | `UpdateContactSchema` |
| POST | `/contacts/:id/assign-to-sales` | `CONTACTS_EDIT`, `LEADS_CREATE` | `AssignToSalesSchema` |

## Quotations & purchase requests

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| GET | `/quotes/:id` | `QUOTES_READ` | — | — |
| PUT | `/quotes/:id` | `QUOTES_EDIT` | `UpdateQuoteSchema` | — |
| GET | `/quotes/:id/pdf` | `QUOTES_READ` | — | Streams `application/pdf` from `lib/quote-pdf.ts` — **not** the JSON envelope |
| POST | `/quotes/:id/send` | `QUOTES_SEND` | `SendQuoteSchema` | Also advances the lead to `Quote Sent` |
| GET | `/purchase-requests/:id` | `PURCHASE_REQUESTS_READ` | — | — |
| PUT | `/purchase-requests/:id` | `PURCHASE_REQUESTS_EDIT` | `UpdatePurchaseRequestSchema` | — |

## Activities & checklists

| Method | Path | Permission | Body |
|---|---|---|---|
| PUT | `/activities/:id` | `ACTIVITIES_EDIT` | `UpdateActivitySchema` |
| DELETE | `/activities/:id` | `ACTIVITIES_DELETE` | — |
| PUT | `/checklists/:id/items/:itemId` | `CHECKLISTS_EDIT` | `ChecklistItemSchema` |

## Analytics & reporting

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/analytics` | `ANALYTICS_READ` | Stage distribution across all stages, per-salesperson stats, activity volume |
| GET | `/performance` | session only | Per-user performance, ownership-scoped |
| GET | `/reports/sla-breaches` | session only | Breached SLA clocks |
| GET | `/reports/sla-trends` | session only | Breach rate over time |
| GET | `/reports/kra-performance` | session only | KRA scoring per user |
| GET | `/audit-log` | `ANALYTICS_READ` | Paginated. Includes `changes`, carrying the stage-change reason and the `outOfSequence` / `flaggedDisqualify` flags |

## Users, roles & organizations

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| GET | `/users` | `USERS_READ` | — | — |
| POST | `/users` | `USERS_CREATE` | `CreateUserSchema` | — |
| GET | `/users/:id` | `USERS_READ` | — | — |
| PUT | `/users/:id` | `USERS_EDIT` | `UpdateUserSchema` | — |
| DELETE | `/users/:id` | `USERS_DELETE` | — | — |
| PUT | `/users/me` | session only | `UpdateSelfSchema` | Self-service profile |
| POST | `/users/:id/quick-login` | admin | — | Issues a magic link exchanged at `/auth/callback`; base URL from `APP_URL` |
| GET | `/roles` | `ROLES_READ` | — | — |
| POST | `/roles` | `ROLES_CREATE` | `CreateRoleSchema` | — |
| GET | `/roles/:id` | `ROLES_READ` | — | — |
| PUT | `/roles/:id` | `ROLES_EDIT` | `UpdateRoleSchema` | Includes `maskPiiData` and `maxExportLimitDaily` |
| GET | `/organizations` | `SETTINGS_EDIT` | — | — |
| POST | `/organizations` | `SETTINGS_EDIT` | `CreateOrgSchema` | — |
| GET | `/organizations/:id` | `SETTINGS_EDIT` | — | — |
| PUT | `/organizations/:id` | `SETTINGS_EDIT` | `UpdateOrgSchema` | — |

## Settings & admin configuration

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| GET / PUT | `/settings` | `SETTINGS_EDIT` | `UpdateSettingsSchema`, `StageSchema` | Auto-assignment rule, workflow stages |
| GET / PUT | `/settings/integrations` | `SETTINGS_EDIT` | `UpdateIntegrationSchema` | Per-org marketplace credentials and webhook secrets, returned masked |
| GET / POST | `/assignment-rules` | `SETTINGS_EDIT` | `CreateAssignmentRuleSchema` | `round_robin` or `least_open_leads` |
| PUT / DELETE | `/assignment-rules/:id` | `SETTINGS_EDIT` | `UpdateAssignmentRuleSchema` | — |
| GET / POST | `/admin/sla-rules` | `SETTINGS_EDIT` | `CreateSlaRuleSchema` | `targetMinutes: null` means measure-only, never breaches |
| PUT / DELETE | `/admin/sla-rules/:id` | `SETTINGS_EDIT` | `UpdateSlaRuleSchema` | — |
| GET / POST | `/admin/business-calendars` | `SETTINGS_EDIT` | `CreateBusinessCalendarSchema`, `DayWindowSchema` | Working hours — SLA clocks only advance inside them |
| PUT / DELETE | `/admin/business-calendars/:id` | `SETTINGS_EDIT` | `UpdateBusinessCalendarSchema` | — |
| GET / POST | `/admin/kra-definitions` | `SETTINGS_EDIT` | `CreateKraDefinitionSchema` | — |
| PUT / DELETE | `/admin/kra-definitions/:id` | `SETTINGS_EDIT` | `UpdateKraDefinitionSchema` | — |
| GET | `/templates` | `SETTINGS_READ` | — | — |
| POST | `/templates` | `SETTINGS_EDIT` | `CreateTemplateSchema` | — |
| PUT / DELETE | `/templates/:id` | `SETTINGS_EDIT` | `UpdateTemplateSchema` | — |

## Webhooks (server-to-server)

**Public** — no session. Authenticated by a secret in the URL path, compared in constant time
(`lib/secure-compare.ts`) against the per-org value on `Settings`, then rate limited
(`lib/rate-limit-db.ts`). All converge on `lib/lead-creation.ts`, so dedup and auto-assignment apply
identically to every channel. Duplicates are acknowledged with `200` rather than an error, so senders
do not retry.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/webhooks/indiamart/:secret` | `IndiaMartWebhookSchema` | Dedups on `Lead.externalId` = `UNIQUE_QUERY_ID` |
| POST | `/webhooks/tradeindia/:secret` | `TradeIndiaLeadSchema` | — |
| POST | `/webhooks/email/:secret` | `SendGridInboundSchema` | SendGrid inbound parse; the sender becomes the contact |
| GET | `/webhooks/whatsapp` | — | Meta Cloud API verification handshake (`hub.challenge`) |
| POST | `/webhooks/whatsapp` | `WhatsAppWebhookSchema` | **Inbound only.** Delivery/read callbacks are acknowledged and skipped. There is no outbound send path |

## Cron (server-to-server)

Require `Authorization: Bearer $CRON_SECRET`, compared in constant time. Intended for Vercel Cron or
any external scheduler — see `docs/DEPLOYMENT.md`.

| Method | Path | Notes |
|---|---|---|
| GET | `/cron/sla-check` | Detects breaches and 80% warnings, emails via `lib/sla-email.ts`. Each clock is claimed with a conditional update *before* sending, so overlapping runs cannot double-send |
| GET | `/cron/follow-up-nudges` | Flags overdue follow-ups; cancels those whose lead left `Quote Sent`. Same claim-before-write guard |
| GET | `/cron/justdial-poll` | Polls the JustDial Lead Manager API per org over a fixed 20-minute lookback. **Must run more often than every 20 minutes** or leads are missed |

## Health & diagnostics

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | **public.** Liveness probe — `{ success: true }` |
| GET | `/diagnostic` | Environment and connectivity check. Excluded from static generation |

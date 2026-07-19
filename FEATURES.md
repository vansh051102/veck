# VECK — Feature Reference

What the product does today, and which code owns each capability.

**Scope of this document:** capabilities only. It carries no status column and no roadmap — for
per-item progress see **[VECK_Feature_Backlog_Progress_List.md](VECK_Feature_Backlog_Progress_List.md)**,
for the technical spec see **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)**, and for endpoint
contracts see **[docs/API.md](docs/API.md)**.

VECK is a B2B CRM and lead-management platform for Indian trading operations: it ingests leads from
marketplaces, drives them through a governed sales pipeline, generates quotations, and holds teams to
SLAs and KRAs.

---

## Auth & Access Control

Authentication is **Supabase Auth** (`@supabase/auth-helpers-nextjs`). `middleware.ts` resolves the
session and injects `x-user-id`, `x-org-id`, and `x-user-role` into every request; fine-grained
permission checks then run inside the route handlers.

| Capability | Owned by |
|---|---|
| Signup / signin / session | `app/api/v1/auth/{signup,signin,me}`, `app/auth/*` pages |
| Permission strings & role→permission map | `lib/permissions.ts` (`PERMISSIONS`, `ROLE_PERMISSIONS`) |
| Enforcement (`requirePermission`, ownership scoping) | `lib/rbac.ts`, `lib/ownership.ts` |
| Roles & hierarchy admin | `app/api/v1/roles`, `app/admin/workspace/[orgId]/roles-hierarchy` |
| Per-org module toggles | `lib/modules.ts` (`isModuleEnabled`), `app/admin/workspace/[orgId]/module-access` |
| Audit trail | `lib/audit.ts` (`logAudit`), `app/api/v1/audit-log` |

Roles: `admin`, `marketing_manager`, `marketing_executive`, `sales_manager`, `sales_executive`,
`purchase`, and the dual `sales_purchase`.

**Data protection on export.** `app/api/v1/leads/export/route.ts` gates on `LEADS_EXPORT`, then applies
the requester's role policy from the `Role` model: `maskPiiData` masks all but the last 4 characters of
email/phone/GST, and `maxExportLimitDaily` caps rows per day. Admins bypass both.

## Lead Management

| Capability | Owned by |
|---|---|
| Lead CRUD, list, bulk ops | `app/api/v1/leads/{route,bulk,[id]}`, `app/(app)/leads` |
| Central creation path (used by every ingestion channel) | `lib/lead-creation.ts` (`createLeadWithDefaults`) |
| Stage model, terminal/won stages, deal-lost reasons | `lib/lead-stages.ts`, `app/api/v1/leads/[id]/stage` |
| Auto-assignment (round-robin / least-open-leads) | `lib/auto-assign.ts` (`pickAssignee`), `app/api/v1/assignment-rules` |
| Import / export | `app/api/v1/leads/{import,export}`, `lib/csv.ts` |
| Timeline & activities | `app/api/v1/leads/[id]/{timeline,activities}` |
| Documents on a lead | `app/api/v1/leads/[id]/documents` |
| Follow-up scheduling & nudges | `lib/follow-up.ts` (`createFollowUpSchedule`), `app/api/v1/cron/follow-up-nudges` |
| Contacts | `app/api/v1/contacts`, `app/(app)/contacts` |

**SOP enforcement.** `lib/sop-checklists.ts` defines stage-gated checklists per track —
`SALES_SOP_CHECKLISTS`, `MARKETING_SOP_CHECKLISTS`, `PURCHASE_SOP_CHECKLISTS` — resolved by
`sopTrackForRole()` / `getSopChecklistsForStage()` and surfaced through
`app/api/v1/leads/[id]/checklists`.

## Omnichannel Lead Ingestion

Marketplace leads land automatically. Webhook routes authenticate via a secret in the path
(compared with `lib/secure-compare.ts`), are rate-limited (`lib/rate-limit-db.ts`), and funnel into
`createLeadWithDefaults`. Credentials are managed per-org at
`app/admin/workspace/[orgId]/integrations`.

| Channel | Mechanism | Route |
|---|---|---|
| IndiaMart | Inbound webhook, dedup on `Lead.externalId` (`UNIQUE_QUERY_ID`) | `app/api/v1/webhooks/indiamart/[secret]` |
| TradeIndia | Inbound webhook | `app/api/v1/webhooks/tradeindia/[secret]` |
| Email | SendGrid inbound-parse → Contact + Lead | `app/api/v1/webhooks/email/[secret]` |
| WhatsApp | Meta Cloud API — verification (GET) + **inbound** messages (POST) | `app/api/v1/webhooks/whatsapp` |
| JustDial | **Polling**, not webhook — 20-min lookback | `app/api/v1/cron/justdial-poll` → `lib/integrations/justdial.ts` (`pollAllOrgs`) |

WhatsApp is **inbound-only**: there is no outbound send path, no conversational bot, and inbound
messages are not retained as a per-lead message log.

## Quotations

| Capability | Owned by |
|---|---|
| Quote CRUD | `app/api/v1/quotes/[id]`, `app/api/v1/leads/[id]/quotes` |
| PDF generation (`pdf-lib`) | `lib/quote-pdf.ts` (`buildQuotePdf`), `app/api/v1/quotes/[id]/pdf` |
| Sending a quote | `app/api/v1/quotes/[id]/send` |
| Sequential document numbers | `lib/numbering.ts` (`nextQuoteNumber`, `nextPurchaseRequestNumber`, …) |
| Purchase requests | `app/api/v1/purchase-requests`, `app/api/v1/leads/[id]/purchase-requests` |
| Templates | `app/api/v1/templates`, `app/admin/workspace/[orgId]/templates` |

## SLA, KRA & Performance

The SLA engine measures in **business** time, not wall-clock — `BusinessCalendar` defines working
hours so leads arriving overnight don't burn a rep's clock.

| Capability | Owned by |
|---|---|
| Business-hours math, clock start/stop, breach test | `lib/sla-engine.ts` (`addBusinessMinutes`, `elapsedBusinessMinutes`, `startSlaClock`, `closeOpenSlaClocks`, `isSlaBreached`) |
| SLA rule config | `SlaRule` model, `app/api/v1/admin/sla-rules` |
| Working-hours config | `BusinessCalendar` model, `app/api/v1/admin/business-calendars` |
| Breach detection sweep | `app/api/v1/cron/sla-check` |
| Breach / warning emails (`resend`) | `lib/sla-email.ts` |
| KRA definitions & scoring | `KraDefinition` model, `app/api/v1/admin/kra-definitions` |
| Reports | `app/api/v1/reports/{sla-breaches,sla-trends,kra-performance}` |
| SLA dashboard | `app/(app)/sla-dashboard`, `app/admin/workspace/[orgId]/sla-dashboard` |

## Dashboards & Analytics

Each role lands on its own dashboard, routed by `lib/dashboard-routes.ts`.

- Per-role dashboards — `app/(app)/dashboards/{admin,sales,purchase,marketing,sales-purchase}`
- Analytics — `app/(app)/analytics` + `app/api/v1/analytics`: stage distribution across all stages,
  per-salesperson stats, activity volume. (No interactive drill-down/filter yet.)
- Lead KPI counts — `app/api/v1/leads/stats`
- Performance view — `app/(app)/performance`, `app/api/v1/performance`

## Multi-tenant Administration

Every tenant is an `Organization`; 56 of 62 `app/api/v1` routes are `orgId`-scoped.

Admin workspace (`app/admin/workspace/[orgId]/*`) covers company details, members, roles & hierarchy,
module access, lead settings, lead workflow, stage mapping, integrations, templates & template
insights, subscriptions, and the SLA dashboard.

Operational: `app/api/v1/users/[id]/quick-login` (admin-issued magic link, exchanged at
`app/auth/callback`), `app/api/v1/organizations`, `app/api/v1/settings`.

## Background Jobs

Three scheduled endpoints, all authenticated with `Authorization: Bearer $CRON_SECRET`. There is no
`vercel.json` — schedules are configured externally.

| Job | Purpose |
|---|---|
| `app/api/v1/cron/sla-check` | Detect SLA breaches/warnings, dispatch notifications |
| `app/api/v1/cron/follow-up-nudges` | Nudge on overdue follow-ups |
| `app/api/v1/cron/justdial-poll` | Pull new JustDial leads for every configured org |

---

## Not implemented (do not mistake for features)

- **Tally Bridge.** `app/admin/workspace/[orgId]/tally-bridge/page.tsx` is a 13-line
  *"Configuration UI placeholder"*. There is no sync — no XML exchange, no API client, no worker. The
  `TallySyncQueue` table exists only inside the unapplied ERP migration
  (`prisma/migrations/20260709223455_erp_ledger_tally_conversion/migration.sql`), not in
  `prisma/schema.prisma`.
- **Trading ERP module** (sales/purchase orders, invoicing, inventory, accounting) — specified in
  `IMPLEMENTATION_PLAN.md` Phase 2–3 and tracked as backlog Phase 8; the ERP source is currently
  excluded from the build. Some `lib/numbering.ts` helpers (`nextSalesOrderNumber`,
  `nextInvoiceNumber`) exist ahead of the module.
- **WhatsApp outbound / chatbot / comms log** — inbound ingestion only (see above).
- **Email threads on a lead** — inbound email creates leads; outbound is limited to SLA notifications.

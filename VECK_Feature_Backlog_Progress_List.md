# VECK CRM — Feature & Bug Backlog (Dependency-Ordered)

Last updated: 2026-07-05

Status key: **[DONE]** verified in code · **[PARTIAL]** some scaffolding exists but incomplete/not wired up · **[NOT STARTED]** no evidence in code. Verified against the actual codebase in this project on 2026-07-05.

## Team directory (reference only — do not hardcode in app logic)

RBAC must be driven by a **Role** field on the user record, not by name or email checks in code. Names/emails below are for QA and permission-testing reference only.

| Name | Phone | Role | Email |
|---|---|---|---|
| Saqlain Pasha | 89716 06057 | Purchase | veckteam03@gmail.com |
| Priyanka G | 99801 35557 | Sales / Purchase | veckteam60@gmail.com |
| Harish | 87926 86668 | Sales | veckteam06@gmail.com |
| Anirudh | 96323 32021 | Marketing | veckteam05@gmail.com |
| Priyanka K | 72042 21644 | Sales / Purchase | veckteam52@gmail.com |
| Vansh G | 8758751807 | Sales | vanshgupta0511@gmail.com |
| Vansh Demo | 9841030307 | Admin | vansh051102@gmail.com |
| Nalin G | 9341760607 | Admin | info@veckcompany.com |
| Nalin Demo | 7019709753 | Admin | nalingupta.1975@yahoo.co.in |

Roles in the system: **Admin, Sales, Purchase, Sales/Purchase (dual), Marketing**. Every visibility rule below (stages, dashboards, tabs, filters, buttons) should resolve against these five roles, not against individual users. Adding/removing a person should never require a code change.

Where a specific name (Saqlain, Anirudh, Priyanka, Vansh, Harish, Nalin, etc.) appears in a backlog item below, it's there only because that's who reported the issue or whose account was used to test it — it identifies the **role** to build against, not a user to hardcode. Any logic implemented for "Saqlain's tab" should really be "the Purchase role's tab," and so on, so it keeps working correctly if that person changes roles or leaves.

---

## Phase 0 — RBAC, Roles & Team Management (foundation, do first)

Everything downstream (stage visibility, dashboards, performance tabs, import/export permissions) depends on this being solid. Building features on top of broken RBAC means redoing them later.

1. [PARTIAL] Clean up RBAC and team management properly — single source of truth for role → permission mapping. `Role.permissions` Json field exists in schema, but `middleware.ts` only checks admin-vs-not-admin.
2. [NOT STARTED] Fix job title / "Workspace Owner" label showing incorrectly for the Purchase role (reported against Saqlain's account — bug is in how the label resolves from role, not specific to that user; fix at the role level so it's correct for anyone assigned Purchase).
3. [NOT STARTED] Add nalingupta.1975@yahoo.co.in as a member/owner (Admin role, per table above).
4. [NOT STARTED] Role access review — confirm each of the 5 roles maps to the correct permission set end to end.
5. [NOT STARTED] Only the stages relevant to a user's role should appear in their stage dropdown/upper navigation (Purchase sees Purchase-relevant stages, Sales sees Sales-relevant stages, etc.).
6. [NOT STARTED] Stage configuration by role: e.g. Qualified → Quote Sent belongs to Purchase; all other stage transitions belong to Sales. Encode this as configurable data, not hardcoded per-user logic.
7. [PARTIAL] Export function restricted to Admin only, in configuration settings. Export endpoint exists (`app/api/v1/leads/export/route.ts`) but role-gating unconfirmed.
8. [NOT STARTED] Remove "Import" button from Sales role in the Contacts module.
9. [NOT STARTED] Don't give general import access — allow manual lead creation only for roles without import rights.
10. [NOT STARTED] Assignment rules not saving correctly — fix persistence bug.
11. [NOT STARTED] When Admin clicks into any user whose role is Sales (e.g. Vansh G, Harish) or Sales/Purchase (e.g. Priyanka G, Priyanka K), it should land on that person's dashboard view for their role, not the admin view. Route by role, not by a per-user lookup table.

## Phase 1 — Critical bugs (data integrity & core workflows)

Fix before building new features on top of these flows.

1. [PARTIAL] Import leads not working. Import endpoint exists and is functional (`app/api/v1/leads/import/route.ts`); the specific reported bug couldn't be confirmed statically — needs a live repro.
2. [NOT STARTED] New lead with same phone number or email should auto-link/assign to the existing customer record instead of creating a duplicate.
3. [NOT STARTED] Don't allow manually adding a lead if a matching lead already exists (phone number match check across all lead pages).
4. [NOT STARTED] Filter resets when navigating back — persist filter state across navigation.
5. [NOT STARTED] Analytics bug (needs your input on exact repro steps to scope — flagged below). No analytics page currently exists.
6. [NOT STARTED] Analytics "auto-refresh" issue — currently hardcoded, not actually live; needs a real refresh mechanism.
7. [NOT STARTED] 2 stages missing from the analytics pie chart. No pie chart / analytics page exists yet.
8. [NOT STARTED] Overview page glitch.
9. [PARTIAL] Negative time showing for Qualified → Quote Sent duration (likely timestamp/timezone calculation bug). SLA calc exists in `lib/workflow.ts`; specific negative-value bug not isolated.
10. [NOT STARTED] Call log bug on the "Contacted" stage.
11. [NOT STARTED] Call log bug on "Quote Sent" stage — audit all other stages for the same issue.
12. [NOT STARTED] Quote modal not appearing when a lead is added directly (skips the modal it should trigger).
13. [PARTIAL] Timeline duplicated in the lead view — investigate and remove the duplicate render. Timeline data models exist; specific duplicate-render bug not isolated.
14. [PARTIAL] Timeline missing entirely from the lead detail modal. Same as above — data exists, rendering issue not isolated.

## Phase 2 — Lead Capture, Dedup & Assignment

1. [NOT STARTED] Define bulk import data format (template/spec) before building the importer.
2. [NOT STARTED] Bulk import with an "Assign to" field included.
3. [PARTIAL] Round-robin auto-assignment engine, with the distribution parameter kept configurable (not fixed). `lib/auto-assign.ts` currently does least-open-leads assignment, not true round-robin, and isn't configurable despite a `Settings.autoAssignmentRule` field existing.
4. [PARTIAL] Auto-assign leads when round-robin mode is active. Same caveat as above — assignment logic exists but isn't true round-robin.
5. [NOT STARTED] Consolidate email, WhatsApp, and call leads with the same requirement into a single lead record — test edge cases (same contact, different channel, near-simultaneous submission).
6. [NOT STARTED] Auto-assign leads to the salesperson who already owns that customer, to increase visibility for the rep who's been working the account.
7. [NOT STARTED] Clarify and log the distinction between "Owner" and "Sales member" on a lead (who created/owns it vs. who's actively working it).
8. [NOT STARTED] Consolidate the "5 separate sources" that currently generate one enquiry into a single lead.
9. [NOT STARTED] Add "Veck" as a source option for Marketing.
10. [NOT STARTED] Add a description field when creating a new lead.
11. [DONE] Show date and time of lead creation on the main lead list page (time optional, date mandatory). Confirmed in `app/api/v1/leads/route.ts`.

## Phase 3 — Pipeline: Stages, Priority, SLA

1. [DONE] Confirm stage-jump / skip-stage capability — already implemented, verify no regressions.
2. [NOT STARTED] Priority field should only appear starting at "New Lead" and "Qualified for Purchase" stages, not earlier.
3. [NOT STARTED] Split priority into two distinct fields: pre-quote priority (Low / Mid / High) and post-quote follow-up priority (1–5, descending urgency).
4. [NOT STARTED] Quotation number should not be mandatory when marking a lead as Quote Sent.
5. [NOT STARTED] Capture rate, margin, and quotation value at the point of marking Quote Sent; also expose this as a quick-entry ("makeshift") field on the main list view, not only inside the modal.
6. [NOT STARTED] Capture quantity sold and unit of measure at Quote Sent.
7. [PARTIAL] SLA timer between any two configurable stages. SLA logic exists for one specific transition (see below) but isn't generalized/configurable across arbitrary stage pairs.
8. [DONE] SLA specifically for Qualified → Quote Sent. Confirmed in `lib/workflow.ts` and `app/api/v1/cron/sla-check/route.ts`.
9. [NOT STARTED] SLA for the Purchase team during quote creation.
10. [NOT STARTED] Call-count guardrails per stage (e.g. 3 calls before a stage nudge, 6 calls after Quote Sent) — require a reason once the threshold is crossed.
11. [NOT STARTED] Add a dropdown for call-log reason/type (replacing free text).
12. [NOT STARTED] Downgrade option (move a lead backward a stage) — must be visible in the timeline; needs to work for Admin and for the salesperson's own view.
13. [DONE] Dropdown for Deal Lost reason (replacing free text). Confirmed via `DEAL_LOST_REASONS` in `lib/lead-stages.ts`, enforced in `lib/workflow.ts`.
14. [NOT STARTED] Deal Lost modal: "Other" reason must require accompanying text (mandatory, not optional).
15. [DONE] Consolidate deal-lost reasons into one shared, maintained list. Same source as item 13 above.
16. [NOT STARTED] If a lead is marked Disqualified/Lost but has a future requirement, capture a follow-up date instead of closing it permanently.
17. [PARTIAL] Add a "Dormant" state alongside Deal Lost / Disqualified for leads that may reopen later. Not implemented as a real, distinct stage yet.

## Phase 4 — Deal Won Workflow

1. [NOT STARTED] Add "New customer" vs. "Repeat customer" toggle in the Deal Won modal.
2. [NOT STARTED] Add UOM options in Deal Won (kg, ton, sqft, sqmtr, no. of pieces).
3. [NOT STARTED] Add profit % calculation on top of UOM.

## Phase 5 — Analytics & Reporting

1. [NOT STARTED] Fix the analytics bug once repro steps are confirmed (see Phase 1 note).
2. [NOT STARTED] Add quarterly filter to analytics.
3. [NOT STARTED] Default analytics page view to "Today".
4. [NOT STARTED] Build a separate analytics dashboard for Sales members (role-scoped).
5. [PARTIAL] Analytics dashboard covering all lead stages, filterable/explorable. Only a plain dashboard with fixed KPI counts exists (`app/(app)/dashboard/page.tsx`, `app/api/v1/leads/stats/route.ts`) — no charts or stage-level exploration.
6. [NOT STARTED] KPI cards on the all-leads page should reflect whatever lead-stage filter is currently active.
7. [NOT STARTED] Total number of calls as a KPI.
8. [NOT STARTED] Total number of leads that reached Qualified as a KPI.
9. [NOT STARTED] Number of WhatsApp messages sent as a KPI.
10. [NOT STARTED] "Contacted within 1 hour" KPI should exclude overnight hours — leads arriving after hours shouldn't count against reps until calling starts at 10am.
11. [NOT STARTED] SLA lapses by salesperson, shown in a Google-Sheet-style KPI table in Analytics.
12. [NOT STARTED] Daily report, including the same KPI set shown in the overview.
13. [NOT STARTED] Separate performance tabs for Sales, Marketing, and Purchase (currently shared/undifferentiated).
14. [NOT STARTED] Fix visibility bug on the performance tab for the Purchase role (reported against Saqlain's account — should be role-scoped so it works for anyone in Purchase).
15. [NOT STARTED] Add "average time between Qualified and Quote Sent" metric, scoped to the Purchase role (reported by Saqlain, but this is a role-level SLA metric — should surface for any Purchase user, not hardcoded to one account).
16. [NOT STARTED] Marketing-role KPIs: count of contacted, count of qualified, count marked as lead (reported by Anirudh — applies to anyone assigned the Marketing role).
17. [NOT STARTED] Won-deal data filterable by source, for the Marketing role view (reported by Anirudh — role-scoped, not user-specific).
18. [NOT STARTED] Separate lead funnel per person and per department.
19. [NOT STARTED] "Total weight" and "Analytics" modals — need your input to scope exact contents before building (flagged below).
20. [NOT STARTED] Sales-person stage values shown as counts (nos.) in relevant dashboard.

## Phase 6 — Communications & External Integrations

1. [NOT STARTED] JustDial integration.
2. [NOT STARTED] TradeIndia integration and testing.
3. [PARTIAL] IndiaMart: test integration, then pull 1-year historical data export. A real inbound webhook with dedup exists (`app/api/v1/webhooks/indiamart/[secret]/route.ts`); no historical data pull built.
4. [NOT STARTED] Connect company email (not personal) for lead email threads.
5. [NOT STARTED] WhatsApp chatbot on the company's own business number. No WhatsApp code found anywhere in the repo.
6. [NOT STARTED] Separate WhatsApp number per salesperson.
7. [NOT STARTED] Enable WhatsApp Business app access for the Marketing role (requested for Anirudh's account — this is a one-time account/device setup task, not app logic, so it doesn't need role-based code, just needs to be done for whoever currently holds the Marketing role).
8. [PARTIAL] Quotation module for the Purchase team. Generic `Quote`/`PurchaseRequest` models exist but aren't Purchase-role-specific.
9. [NOT STARTED] WhatsApp communications tracking/log (WA comms).

## Phase 7 — UI, Navigation & Performance Polish

1. [NOT STARTED] Improve site load speed.
2. [DONE] Rename "Info Collected" stage label to "Quote Sent" throughout the UI.
3. [NOT STARTED] Smoother backward navigation (reduce jarring transitions).
4. [NOT STARTED] Add a "Clear filter" button.
5. [NOT STARTED] Advanced filters, separated for Marketing, Sales, and Purchase views.
6. [NOT STARTED] Hover box should stay open while the cursor is over it (currently disappears).
7. [NOT STARTED] Remove the date/time hover artifact shown on invalid form states.
8. [NOT STARTED] Hover on the left side of a stage change shows date/time; hover on the right (last contacted) shows its own date/time — implement consistently across all lead pages.
9. [NOT STARTED] Timeline should be scrollable to show full history, not truncated.
10. [NOT STARTED] Notes and call logs displayed together in one view.
11. [NOT STARTED] "Add reminder" action/flyer on lead cards across all lead pages (e.g., prompted automatically on Deal Lost).
12. [NOT STARTED] Reminder recurrence options: 1, 2, 3, 4, 5, 6 days, weekly, 10, 15, 20 days.
13. [PARTIAL] Improve the export button with a fuller list of export options (e.g., weekly number/email export). One plain CSV export endpoint exists; no expanded option set.
14. [NOT STARTED] Fix KPI figures currently shown incorrectly in email reports.
15. [NOT STARTED] Add "Stages" button and "Log message" button — need clarification on current vs. expected behavior (flagged below).
16. [NOT STARTED] Fix pagination ("rows and pages") issue — need clarification on the specific bug (flagged below).
17. [NOT STARTED] Add a modal to capture data on "good calls" (qualitative call outcome tracking).

---

## Needs your clarification before scoping

These items are too ambiguous to sequence or estimate as written:

- **"Analytics bug"** — what specifically breaks, and on which page/filter?
- **"Analytics modal" / "Total weight modal"** — what data should each contain and where do they open from?
- **"Rows and pages"** — is this a pagination count bug, a page-size setting, or something else?
- **"Stages button" / "Log message button"** — are these missing entirely, or present but misbehaving?

Happy to fold answers into this doc once you clarify — just flag which item and I'll update it in place.

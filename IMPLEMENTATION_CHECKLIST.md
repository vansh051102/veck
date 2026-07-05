# VECK Implementation Checklist

**Status:** ✅ Ready to Start  
**Start Date:** July 5, 2026  
**Project:** https://github.com/vansh051102/veck

---

## 🚀 PHASE 1: CRM & SALES (Weeks 1-4)

### Week 1: Database Schema & API Scaffold

**Database (Prisma Models)**
- [ ] Lead model with all fields (name, company, email, phone, etc.)
- [ ] Contact model (linked to Lead)
- [ ] Activity model (Call, Email, Note, Meeting types)
- [ ] Checklist model (linked to Lead, Step tracking)
- [ ] ChecklistItem model (with completion tracking)
- [ ] Timeline model (audit trail)
- [ ] Quote model (basic structure)
- [ ] PurchaseRequest model (basic structure)
- [ ] Run `prisma migrate dev`
- [ ] Verify all relationships & indexes

**API Scaffold**
- [ ] Setup `/api/v1/leads/` directory structure
- [ ] Setup `/api/v1/activities/` directory structure
- [ ] Setup `/api/v1/checklists/` directory structure
- [ ] Health check endpoint working
- [ ] Auth middleware applied to all protected routes
- [ ] Standard response format (success/error builders)
- [ ] Error handling for all routes

**Testing Foundation**
- [ ] Jest config setup
- [ ] Playwright E2E setup
- [ ] Test database environment
- [ ] First health check test passing

---

### Week 2: Core CRUD & Workflow Engine

**Lead Endpoints**
- [ ] `POST /api/v1/leads` - Create lead (Step 1)
  - [ ] Auto-create NEW_LEAD checklist
  - [ ] Set initial stage to NEW_LEAD
  - [ ] Create timeline event
- [ ] `GET /api/v1/leads` - List with pagination & filters
- [ ] `GET /api/v1/leads/:id` - Get single lead
- [ ] `PUT /api/v1/leads/:id` - Update lead
- [ ] `PUT /api/v1/leads/:id/stage` - Change stage with validation
- [ ] `PUT /api/v1/leads/:id/assign` - Assign to user
- [ ] `DELETE /api/v1/leads/:id` - Soft delete

**Activity Endpoints**
- [ ] `POST /api/v1/leads/:id/activities` - Create activity
  - [ ] Handle Call type (duration, outcome)
  - [ ] Handle Email type (subject, notes)
  - [ ] Handle Note type
  - [ ] Handle Meeting type (attendees, date)
  - [ ] Update last_activity timestamp
  - [ ] Increment activity counter
- [ ] `GET /api/v1/leads/:id/activities` - List activities
- [ ] `PUT /api/v1/activities/:id` - Update activity
- [ ] `DELETE /api/v1/activities/:id` - Delete activity

**Checklist Endpoints**
- [ ] `POST /api/v1/leads/:id/checklists` - Create checklist (auto on lead create)
- [ ] `GET /api/v1/leads/:id/checklists` - Get checklists
- [ ] `PUT /api/v1/checklists/:id/items/:itemId` - Toggle item completion
- [ ] Calculate checklist completion % 

**Workflow State Machine**
- [ ] NEW_LEAD → CONTACTED validation
  - [ ] Require 1+ activity
  - [ ] Block if no contact attempt
- [ ] CONTACTED → QUALIFIED validation
  - [ ] Require completed CONTACTED checklist (20 items)
  - [ ] Require 3+ activities minimum
- [ ] QUALIFIED → QUOTE_SENT validation
  - [ ] Require completed QUALIFIED checklist (14 items)
  - [ ] Require handover flag
- [ ] QUOTE_SENT → CLOSED_WON validation
  - [ ] Require completed QUOTE_SENT checklist
- [ ] Any → DISQUALIFIED allowed (with reason)
- [ ] Prevent invalid stage transitions
- [ ] Log all stage changes to timeline

**SLA Engine**
- [ ] Calculate SLA deadline on lead create (NEW_LEAD = +1 hour)
- [ ] Update SLA on stage change (CONTACTED = +24h, QUALIFIED = +3h, QUOTE_SENT = +6d)
- [ ] Track SLA breach (if current_time > sla_deadline)
- [ ] Create timeline event on SLA breach

**Testing**
- [ ] 20+ unit tests for CRUD operations
- [ ] 15+ unit tests for workflow validation
- [ ] 10+ tests for SLA calculation
- [ ] All tests passing

---

### Week 3: Frontend - Dashboard & Table

**Dashboard Component** (`app/dashboard/page.tsx`)
- [ ] 4 metrics cards component
  - [ ] Total leads
  - [ ] Open leads (unassigned or no recent activity)
  - [ ] Hot or Urgent (High/Urgent priority)
  - [ ] Won this month
- [ ] Real-time data fetch (SWR/React Query)
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive grid layout

**Leads Page** (`app/leads/page.tsx`)
- [ ] a competitor-style layout
- [ ] Metrics bar (4 cards)
- [ ] View toggle: List/Kanban
- [ ] Time range filter buttons (All time, 7 days, 30 days, 4 months, Custom)
- [ ] Search box (real-time filter)
- [ ] Control buttons:
  - [ ] Import/Export dropdown
  - [ ] Assignment Rules button
  - [ ] New Lead button (green CTA)
- [ ] Stage tabs (All, New Lead, Contacted, Qualified, Quote Sent, Closed Won, Deal Lost, Disqualified)

**Leads Table Component**
- [ ] TanStack Table setup (virtualization for 1000+ rows)
- [ ] 8 columns:
  1. [ ] Checkbox (bulk select + select all)
  2. [ ] Company name (clickable → detail view)
  3. [ ] Contact person (phone, email)
  4. [ ] Stage (inline dropdown)
  5. [ ] Stage details
  6. [ ] Priority (inline dropdown)
  7. [ ] Assigned to (inline dropdown)
  8. [ ] Last activity (timestamp)
- [ ] Sorting on columns
- [ ] Hover actions (eye, phone, chat icons)
- [ ] Row click → Lead detail view
- [ ] Real-time updates via WebSocket (optional for Phase 1)
- [ ] Pagination or infinite scroll
- [ ] Column filters (funnel icons)

**New Lead Modal**
- [ ] Form fields: Name, Company, Phone, Email, Source
- [ ] Validation (Zod schema)
- [ ] Submit → Create lead API
- [ ] Success message + redirect to detail
- [ ] Error handling

**Styling**
- [ ] Match a competitor color scheme (dark green sidebar, light gray cards)
- [ ] Responsive design (desktop first)
- [ ] Dark mode support (optional for Phase 1)
- [ ] Tailwind CSS + shadcn/ui components

---

### Week 4: Testing, Optimization & Deployment

**Lead Detail Page** (`app/leads/[id]/page.tsx`)
- [ ] Header: Company, stage selector, assign dropdown
- [ ] Left sidebar: Timeline (all events, newest first)
- [ ] Right panel:
  - [ ] Contact info card
  - [ ] Checklists (expandable, progress %)
  - [ ] Activities list (Call, Email, Note, Meeting)
  - [ ] Activity creation forms (4 types)
  - [ ] Quotes list
  - [ ] Purchase requests list
- [ ] Responsive layout (stack on mobile)

**Activity Creation Forms**
- [ ] Call form: Duration, outcome, notes
- [ ] Email form: Subject, to, cc, notes
- [ ] Note form: Free text
- [ ] Meeting form: Date, attendees, notes
- [ ] Auto-save to database on submit
- [ ] Real-time validation

**Integration Tests**
- [ ] Complete lead create → CONTACTED flow
- [ ] Complete CONTACTED → QUALIFIED flow
- [ ] Complete QUALIFIED → QUOTE_SENT flow
- [ ] Checklist blocking stage progression
- [ ] Activity counter blocking progression
- [ ] SLA calculation accuracy
- [ ] Deal lost with reason

**E2E Tests**
- [ ] Create lead from scratch
- [ ] Navigate to lead detail
- [ ] Add activity (call)
- [ ] Stage transition (NEW_LEAD → CONTACTED)
- [ ] Complete checklist
- [ ] Move to QUALIFIED
- [ ] Create quote
- [ ] Move to QUOTE_SENT
- [ ] Mark deal lost

**Performance Optimization**
- [ ] Dashboard: <2 seconds load
- [ ] Leads table: <1 second (first 100 rows)
- [ ] Lead detail: <1.5 seconds
- [ ] API response time: <200ms average
- [ ] Search results: <300ms
- [ ] Table render (1000 rows): <1 second
- [ ] Minify & tree-shake unused code
- [ ] Compress images

**Deployment to Production**
- [ ] Environment variables configured (Supabase, Vercel, etc.)
- [ ] Database migrations run
- [ ] Auth system tested
- [ ] API endpoints verified
- [ ] Frontend builds without errors
- [ ] Deploy to Vercel
- [ ] Smoke tests on production
- [ ] Monitor error logs
- [ ] Setup uptime monitoring

**Documentation**
- [ ] API documentation (all endpoints)
- [ ] Component documentation (Storybook optional)
- [ ] Database schema documented
- [ ] Setup guide for local development
- [ ] Deployment runbook
- [ ] SOP enforcement guide for end users

**Quality Assurance**
- [ ] Test coverage: 75% business logic, 50% components
- [ ] All 95+ tests passing
- [ ] No console errors/warnings
- [ ] Accessibility audit (WCAG AA)
- [ ] Security review (no hardcoded secrets, etc.)
- [ ] Code review by peer
- [ ] Load testing (100 concurrent users)

---

## 📦 PHASE 2: TRADING ERP (Weeks 5-8)

### Week 5: Sales & Purchase Orders

**Database Models**
- [ ] Product model (SKU, specs, pricing)
- [ ] Supplier model (details, ratings)
- [ ] Customer model (enhanced from Phase 1)
- [ ] SalesOrder model
- [ ] SalesOrderItem model
- [ ] PurchaseOrder model
- [ ] PurchaseOrderItem model
- [ ] Shipment model

**Sales Order Endpoints**
- [ ] `POST /api/v1/sales-orders` - Create SO from confirmed lead
  - [ ] Validate lead is QUOTE_SENT
  - [ ] Reserve inventory
  - [ ] Create SO items
- [ ] `GET /api/v1/sales-orders` - List with filters
- [ ] `GET /api/v1/sales-orders/:id` - Get SO detail
- [ ] `PUT /api/v1/sales-orders/:id/confirm` - Confirm SO
  - [ ] Lock inventory reservation
  - [ ] Auto-create invoice
- [ ] `POST /api/v1/sales-orders/:id/shipments` - Create shipment

**Purchase Order Endpoints**
- [ ] `POST /api/v1/purchase-orders` - Create PO
- [ ] `GET /api/v1/purchase-orders` - List
- [ ] `PUT /api/v1/purchase-orders/:id/send` - Send to supplier
- [ ] `POST /api/v1/purchase-orders/:id/goods-receipts` - Receive goods
  - [ ] Update inventory
  - [ ] Mark PO received

**Inventory Management**
- [ ] Stock level tracking per product
- [ ] Reserved stock (from SOs)
- [ ] Available stock = Total - Reserved
- [ ] Low stock alerts (reorder level)
- [ ] Stock movements log

---

### Week 6: Invoicing & Payment Tracking

**Invoice Endpoints**
- [ ] `POST /api/v1/sales-orders/:id/invoice` - Auto-generate invoice
- [ ] `GET /api/v1/invoices` - List invoices
- [ ] `GET /api/v1/invoices/:id` - Get invoice detail
- [ ] `PUT /api/v1/invoices/:id/send` - Send via email
- [ ] `POST /api/v1/invoices/:id/payments` - Record payment

**Payment Tracking**
- [ ] Track paid/unpaid status
- [ ] Days outstanding calculation
- [ ] Payment due date tracking
- [ ] Auto-send payment reminders (2 days before due)

**Invoicing UI**
- [ ] Invoice list view
- [ ] Invoice detail (line items, totals, payment status)
- [ ] Send invoice button (email)
- [ ] Payment recording form

---

### Week 7: Reports

**5 Reports**
- [ ] Sales Register (daily/monthly by product, customer, amount)
- [ ] PO Register (supplier, amount, delivery status)
- [ ] Invoice Aging (30/60/90 days overdue)
- [ ] Outstanding Summary (total AR, aging bucket, customer-wise)
- [ ] Inventory Turnover (units moved, days in inventory)

**Report UI**
- [ ] Filters (date range, product, customer, supplier)
- [ ] Export to CSV
- [ ] Print-friendly view
- [ ] Real-time calculations

---

### Week 8: Testing & Deployment Phase 2

**Integration Tests**
- [ ] Complete SO flow (create → confirm → ship → deliver → invoice → pay)
- [ ] Inventory reservation accuracy
- [ ] PO complete flow
- [ ] Invoice generation & payment tracking
- [ ] Outstanding aging accuracy

**Reports Testing**
- [ ] Sales register accuracy
- [ ] Invoice aging calculation
- [ ] Stock valuation
- [ ] DSO calculation

**Performance**
- [ ] Reports <500ms for large datasets
- [ ] Table rendering 10K+ rows <2s

**Deployment**
- [ ] Phase 2 deploys to production
- [ ] Integrated with Phase 1 leads
- [ ] Pilot with 3-5 customers
- [ ] Monitor for issues

---

## 🤖 PHASE 3: ANALYTICS, AI & ACCOUNTING (Weeks 9-12)

### Week 9: AI Engines (Scoring, Health, Recommendations)

**Lead Scoring Engine**
- [ ] Calculate score 0-100 based on:
  - [ ] Engagement (email opens, interactions)
  - [ ] Historical patterns (similar leads)
  - [ ] Firmographics (company size, industry)
  - [ ] Velocity (speed through pipeline)
- [ ] API endpoint: `GET /api/v1/leads/:id/ai-insights`
- [ ] Daily calculation job (2 AM)
- [ ] Conversion probability (%)
- [ ] Factors breakdown

**Deal Health Monitoring**
- [ ] Detect red flags:
  - [ ] No activity 7+ days
  - [ ] Stalled >2 weeks in same stage
  - [ ] SLA breach
  - [ ] Long time in current stage
- [ ] Detect green flags:
  - [ ] Regular activity (calls, emails)
  - [ ] Quick progression
  - [ ] Multiple stakeholders engaged
- [ ] Health status: Healthy, At Risk, Critical
- [ ] API endpoint: `GET /api/v1/deals/:id/health`
- [ ] Auto-alert sales rep on critical status

**Recommendation Engine**
- [ ] Product recommendations based on company profile
- [ ] Best time to call (based on response patterns)
- [ ] Discount recommendations to close deal
- [ ] Next action suggestions
- [ ] API endpoint: `GET /api/v1/ai/recommendations`

**Testing**
- [ ] Lead score accuracy 80%+ (vs manual assessment)
- [ ] Deal health correctly identifies at-risk
- [ ] Recommendations relevance

---

### Week 10: Workflow Automation

**Automation Engine**
- [ ] `POST /api/v1/automations` - Create workflow
- [ ] `GET /api/v1/automations` - List workflows
- [ ] `PUT /api/v1/automations/:id` - Update workflow
- [ ] `GET /api/v1/automation-logs` - Execution history

**Automation Templates (5+)**
- [ ] **Auto-assign:** Assign leads by rep capacity
- [ ] **Auto-follow-up:** Remind if no contact 48h
- [ ] **Auto-escalate:** Alert manager if deal At Risk
- [ ] **Auto-invoice:** Generate on SO delivery
- [ ] **Auto-reminder:** Payment due reminder 2 days before

**Automation UI (Builder)**
- [ ] Trigger selector (Lead create, Activity, Stage change)
- [ ] Condition editor (If/Then rules)
- [ ] Action selector (Notify, Task, Reassign, etc.)
- [ ] Enable/Disable toggle
- [ ] Execution history view

**Testing**
- [ ] All automation templates execute correctly
- [ ] 99%+ success rate
- [ ] Edge cases handled (no email, duplicate runs, etc.)

---

### Week 11: Executive Dashboards

**4 Dashboards**

**Executive Dashboard** (`/dashboards/executive`)
- [ ] Total revenue (YTD, MTD, QTD)
- [ ] Pipeline value by stage (funnel)
- [ ] Win rate % (this quarter vs historical)
- [ ] Forecast vs actual (line chart)
- [ ] Key metrics: CAC, LTV, DSO
- [ ] Team performance leaderboard

**Sales Dashboard** (`/dashboards/sales`)
- [ ] Personal pipeline value (by stage)
- [ ] Activity metrics (calls, emails this week)
- [ ] Conversion funnel (Leads → Won)
- [ ] Deal aging (stacked time in stage)
- [ ] Recommended next actions (top 5)
- [ ] Performance vs quota

**Operations Dashboard** (`/dashboards/operations`)
- [ ] Order fulfillment rate (on-time %)
- [ ] Supplier performance rating (quality, delivery)
- [ ] Inventory turnover (units/month)
- [ ] Days in inventory by product
- [ ] Stock-outs by product
- [ ] Logistics costs

**Finance Dashboard** (`/dashboards/finance`)
- [ ] Revenue by month (bar chart)
- [ ] Gross margin % (line chart)
- [ ] Operating expenses breakdown (pie)
- [ ] Cash flow forecast (cash position)
- [ ] Accounts receivable aging (30/60/90)
- [ ] Supplier payment terms compliance

**Dashboard UI**
- [ ] Real-time data refresh (SWR)
- [ ] Filter by date range, customer, product
- [ ] Export to PDF/Excel
- [ ] Responsive (mobile-friendly)

---

### Week 12: Accounting & Deployment Phase 3

**Accounting Module** (`/accounting/`)
- [ ] Chart of Accounts (display, categorized)
- [ ] Journal Entry creation:
  - [ ] Date, description
  - [ ] Line items (Debit/Credit)
  - [ ] Auto-balanced validation
  - [ ] Post to ledger
- [ ] General Ledger view (by account)
- [ ] Trial Balance report
- [ ] Financial Statements:
  - [ ] P&L Statement (Revenue - Expenses = Net Income)
  - [ ] Balance Sheet (Assets = Liabilities + Equity)
  - [ ] Cash Flow Statement (Operating, Investing, Financing)
- [ ] GST Compliance (India-specific):
  - [ ] GST register (GSTR-1)
  - [ ] Payable calculation
  - [ ] Input tax credit tracking
  - [ ] Export for government filing

**Accounting Testing**
- [ ] Journal entries balance
- [ ] Financial statements reconcile
- [ ] GST calculation accurate
- [ ] Historical data integrity

**Phase 3 Deployment**
- [ ] Deploy dashboards to production
- [ ] Deploy automation templates (one at a time, monitor)
- [ ] Deploy AI engines
- [ ] Deploy accounting module
- [ ] Monitor performance & accuracy
- [ ] Gather feedback, iterate

**Documentation & Training**
- [ ] Lead scoring explanation guide
- [ ] Deal health indicators guide
- [ ] Automation builder walkthrough
- [ ] Dashboard interpretation guide
- [ ] Accounting basics for non-finance users
- [ ] GST compliance guide
- [ ] Video walkthroughs (3-5 min each)

**Final Quality Assurance**
- [ ] All 70+ tests passing
- [ ] Security audit
- [ ] Performance testing (load test)
- [ ] Accessibility audit
- [ ] Code review
- [ ] User acceptance testing (UAT)
- [ ] Documentation complete

---

## 📊 Summary Checklist

### Pre-Launch (All Phases)
- [ ] All code committed to GitHub
- [ ] All tests passing (250+)
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Team trained on all features
- [ ] Rollback plan ready

### Phase 1 Completion
- [ ] SOP enforced (all 4 steps working)
- [ ] Workflow validation prevents invalid transitions
- [ ] Checklists blocking stage progression
- [ ] SLA tracking accurate
- [ ] UI matches a competitor design
- [ ] <5% SLA breach rate in production

### Phase 2 Completion
- [ ] Order-to-cash complete
- [ ] Inventory accurately tracked
- [ ] Invoices generated & sent
- [ ] Payment tracking working
- [ ] All reports accurate
- [ ] <30 days Days Sales Outstanding

### Phase 3 Completion
- [ ] Lead scoring 80%+ accurate
- [ ] Deal health identifies at-risk deals
- [ ] Automation 99%+ reliable
- [ ] Financial statements reconcile
- [ ] GST reporting accurate
- [ ] Dashboards <2s load time
- [ ] Team using AI features daily

---

## 🚀 Go-Live Criteria

✅ **All 3 phases complete**  
✅ **All tests passing**  
✅ **Performance targets met**  
✅ **Security audit passed**  
✅ **Team trained**  
✅ **Documentation complete**  
✅ **Rollback plan ready**  
✅ **Monitoring & alerts configured**  

---

**Status:** Ready to Start  
**Begin Date:** July 5, 2026  
**Expected Completion:** September 25, 2026


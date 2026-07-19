# VECK - Steel Trading CRM Operating System

**Project:** Process-driven steel trading CRM with ERP capabilities  
**Status:** Phase 1 (CRM & Sales) complete — Phase 2 (Trading ERP) not started  
**Stack:** Next.js 14, TypeScript, React, Tailwind CSS, Prisma, PostgreSQL (Supabase)

For what's built today see **[FEATURES.md](FEATURES.md)**; for live task status see **[VECK_Feature_Backlog_Progress_List.md](VECK_Feature_Backlog_Progress_List.md)**.

## 🎯 Overview

VECK is a technology-first operating system for steel trading businesses. It standardizes business processes instead of relying on individual employees.

**Core Products:**
- Mild Steel Pipes
- Hollow Sections
- Roofing Sheets
- TMT Bars
- HR Coils
- CR Coils
- GP Sheets & GC Sheets
- Structural Steel

## 📦 Phased Rollout

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Phase 0** | Week 1-2 | Foundation, Auth, Admin Portal |
| **Phase 1** | Week 3-8 | CRM & Sales (Leads, Workflow, SLA) |
| **Phase 2** | Week 9-16 | Trading ERP (Orders, Inventory, Invoicing) |
| **Phase 3** | Week 17-24 | Accounting, AI, Automation, Analytics |

## 🚀 Quick Start

```bash
# Clone repo
git clone https://github.com/vansh051102/veck.git
cd veck

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Run dev server
npm run dev
```

Full setup — env vars, Supabase, database — in **[docs/SETUP.md](docs/SETUP.md)**.

## 📋 Architecture

- **Frontend:** Next.js App Router, React, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes, TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **State:** Zustand
- **Forms:** React Hook Form
- **UI Tables:** TanStack Table
- **Auth:** Supabase Auth (JWT) + custom RBAC (`lib/rbac.ts`, `lib/permissions.ts`)
- **Validation:** Zod
- **PDFs:** pdf-lib (quotations) · **Email:** Resend · **Logging:** pino
- **Hosting:** Vercel (frontend), Supabase (backend)

## 📂 Project Structure

```
veck/
├── app/
│   ├── (app)/             # Authenticated app (leads, dashboards, analytics)
│   ├── admin/             # Admin portal + per-org workspace
│   ├── api/v1/            # REST API (62 routes)
│   └── auth/              # Login, signup, callback
├── components/
│   ├── admin/  analytics/  auth/  dashboard/
│   └── ui/                # shadcn/ui primitives
├── lib/                   # Business logic
│   ├── rbac.ts  permissions.ts   # Access control
│   ├── lead-creation.ts  auto-assign.ts  lead-stages.ts
│   ├── sla-engine.ts  sop-checklists.ts  follow-up.ts
│   ├── quote-pdf.ts  numbering.ts
│   ├── integrations/      # JustDial poller
│   └── __tests__/         # Unit tests (Jest)
├── e2e/                   # End-to-end tests (Playwright)
├── prisma/
│   ├── schema.prisma      # Schema single source of truth
│   └── migrations/
├── scripts/
├── src/                   # Phase 2 ERP WIP — excluded from build
├── docs/
└── public/
```

## 🔑 Key Features (Phase 0)

- [x] User authentication (Supabase)
- [x] Role-based access control (RBAC)
- [x] Admin portal
- [x] Database schema (Prisma)
- [x] API scaffold
- [x] Frontend infrastructure
- [ ] Tests & documentation

## 📚 Documentation

Each document has one job — status lives in the backlog, spec lives in the plan, schema lives in Prisma.

**Product & status**
- [Features](./FEATURES.md) — what's built today, and what only looks built
- [Feature & Bug Backlog](./VECK_Feature_Backlog_Progress_List.md) — live task status
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) — master technical spec
- [Roadmap](./ROADMAP.md) — phase summary

**Engineering**
- [Architecture](./docs/ARCHITECTURE.md) — stack, request flow, ingestion, background jobs
- [API Reference](./docs/API.md) — endpoint contracts
- [Database](./docs/DATABASE.md) → [`prisma/schema.prisma`](./prisma/schema.prisma)
- [Setup Guide](./docs/SETUP.md) — local development
- [Database Migrations](./docs/database-migrations.md) — **read before running any migration**
- [Deployment](./docs/DEPLOYMENT.md) — env vars, cron, rollback
- [CLAUDE.md](./CLAUDE.md) — engineering guidelines for AI-assisted changes

**Team**
- [Sales SOP Guide](./docs/SOP_GUIDE.md) — for the sales team

## 👥 Team

- **Lead Architect:** Claude
- **Product Owner:** Vansh Gupta

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For questions or issues, open a GitHub issue on the repository.

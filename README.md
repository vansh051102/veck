# VECK - Steel Trading CRM Operating System

**Project:** Process-driven steel trading CRM with ERP capabilities  
**Status:** Phase 0 - Foundation Setup  
**Stack:** Next.js 14, TypeScript, React, Tailwind CSS, Prisma, PostgreSQL (Supabase)

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
git clone https://github.com/yourusername/veck.git
cd veck

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Run dev server
npm run dev
```

## 📋 Architecture

- **Frontend:** Next.js App Router, React, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes, TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **State:** Zustand
- **Forms:** React Hook Form
- **UI Tables:** TanStack Table
- **Auth:** Supabase Auth (JWT)
- **Hosting:** Vercel (frontend), Supabase (backend)
- **Storage:** Cloudflare R2

## 📂 Project Structure

```
veck/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Auth pages
│   ├── dashboard/         # Dashboard
│   ├── admin/             # Admin portal
│   └── layout.tsx
├── components/            # React components
│   ├── layout/
│   ├── common/
│   ├── forms/
│   ├── leads/
│   └── admin/
├── lib/                   # Utilities
│   ├── api-client.ts
│   ├── auth.ts
│   ├── db.ts
│   ├── permissions.ts
│   ├── validation.ts
│   └── utils.ts
├── hooks/                 # Custom hooks
├── stores/                # Zustand stores
├── styles/                # CSS
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/                  # Documentation
├── tests/                 # Test files
└── public/                # Static assets
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

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Setup Guide](./docs/SETUP.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)

## 👥 Team

- **Lead Architect:** Claude
- **Product Owner:** Vansh Gupta

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For questions or issues, reach out to vanshgupta0511@gmail.com

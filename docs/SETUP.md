# VECK Setup Guide

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 13+ (or Supabase account)
- Git
- Code editor (VS Code recommended)

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/vansh051102/veck.git
cd veck
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Supabase

#### Option A: Use Supabase Cloud (Recommended)

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Wait for the project to initialize
4. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

#### Option B: Use Local Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local Supabase
supabase init

# Start local server
supabase start

# Get credentials from output
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/veck

# API
NEXT_PUBLIC_API_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### 5. Setup Database

#### Initialize Prisma

```bash
# Generate Prisma client
npm run db:push

# Or create migrations
npm run db:migrate
```

This will:
- Create all database tables
- Create Prisma client
- Seed initial data (optional)

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Access Prisma Studio (Optional)

```bash
npm run db:studio
```

This opens a GUI to view and edit your database at [http://localhost:5555](http://localhost:5555).

## Project Structure

```
veck/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Auth pages (login, signup)
│   ├── dashboard/         # Main dashboard
│   ├── admin/             # Admin portal
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── common/           # Shared components
│   ├── forms/            # Form components
│   └── admin/            # Admin-specific components
├── lib/                   # Utilities
│   ├── auth.ts           # Auth utilities
│   ├── db.ts             # Database client
│   ├── api-response.ts   # API response helpers
│   ├── validation.ts     # Zod schemas
│   └── utils.ts          # General utilities
├── hooks/                # Custom React hooks
├── stores/               # Zustand stores
├── middleware.ts         # Next.js middleware
├── prisma/               # Database schema
│   ├── schema.prisma     # Prisma schema
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
├── public/               # Static files
└── tests/                # Test files
```

## Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run e2e              # Run E2E tests

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # Check TypeScript

# Utilities
npm run clean            # Clean build artifacts
npm run format           # Format code with Prettier
```

## API Endpoints

### Authentication

```
POST   /api/v1/auth/signup        - Create new account
POST   /api/v1/auth/signin        - Login
GET    /api/v1/auth/me            - Get current user
```

### Health Check

```
GET    /api/v1/health             - Server health status
```

### Phase 1 (Coming Soon)

```
GET    /api/v1/leads              - List leads
POST   /api/v1/leads              - Create lead
GET    /api/v1/leads/:id          - Get lead
PUT    /api/v1/leads/:id          - Update lead
```

## Troubleshooting

### Database Connection Issues

**Error: "Cannot connect to database"**

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Verify Supabase credentials
# Make sure NEXT_PUBLIC_SUPABASE_URL and DATABASE_URL are correct
```

### Prisma Generation Error

```bash
# Clear Prisma cache
rm -rf node_modules/.prisma

# Regenerate
npm run db:push
```

### Port Already in Use

```bash
# Use different port
npm run dev -- -p 3001
```

## Testing Authentication

### Signup

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "fullName": "Test User",
    "orgName": "Test Organization"
  }'
```

### Signin

```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

### Get Current User

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-org-id: YOUR_ORG_ID"
```

## Deployment

### To Vercel

1. Push code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com/dashboard)
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
4. Deploy

### To Other Platforms

See [Next.js Deployment Docs](https://nextjs.org/docs/app/building-your-application/deploying)

## Next Steps

1. **Phase 0 Completion**
   - [ ] All API routes functional
   - [ ] Authentication flow tested
   - [ ] Database schema validated

2. **Phase 1: CRM & Sales**
   - Build leads management API
   - Create CRM frontend components
   - Implement workflow engine
   - Add SLA tracking

## Getting Help

- Check [docs](./docs) folder
- Read [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- Open [GitHub Issues](https://github.com/vansh051102/veck/issues)
- Contact: vanshgupta0511@gmail.com

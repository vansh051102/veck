# Database

## Provider

PostgreSQL hosted on Supabase. Connection is managed via Prisma ORM.

## Schema Source of Truth

All models are defined in [`prisma/schema.prisma`](../prisma/schema.prisma). This file is the single source of truth — do not maintain a separate schema doc.

## Key Models

| Model | Purpose |
|-------|---------|
| `User` | Platform users with role assignments |
| `Organization` | Tenant/company grouping |
| `Lead` | Core CRM entity — prospects and their lifecycle |
| `LeadActivity` | Audit trail of lead interactions |
| `SOP` / `SOPStep` | Standard Operating Procedure definitions |
| `Role` / `Permission` | RBAC building blocks |

See `prisma/schema.prisma` for full field definitions and relations.

## Migrations

```bash
# Apply schema changes to dev database
npm run db:push

# Generate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (visual DB browser)
npx prisma studio
```

## Connection

Set `DATABASE_URL` in `.env.local`. See [`.env.example`](../.env.example) for the expected format.

For local development, use the Supabase project's connection pooler URL (port 5432).

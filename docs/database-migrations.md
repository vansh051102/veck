# Database migrations

## Context

This project's database was originally managed by **`prisma db push`** plus
hand-written SQL in `prisma/migrations/manual/` — there was no native Prisma
migration history (`_prisma_migrations` table). That's fine for a solo/early
project, but it means `prisma migrate dev` sees "drift" and can offer to **reset
the database**, and there's no versioned, reviewable record of schema changes.

We've now **baselined** the project onto native Prisma Migrate:

```
prisma/migrations/
  migration_lock.toml
  0_init/                                   ← baseline: the full schema as it
    migration.sql                             already exists in the live DB
  20260709223455_erp_ledger_tally_conversion/
    migration.sql                           ← the ERP ledger + TallySyncQueue +
                                              Lead-conversion change
prisma/legacy-sql/                          ← old hand-written SQL, archived
```

- **`0_init`** is generated from the schema *before* the ERP changes, i.e. it
  matches what is already in the database. It is **never run** against the
  existing DB — it's marked as already-applied (see below). On a *fresh* DB it
  recreates the whole schema.
- The **timestamped ERP migration** is the only change that actually gets
  applied to the existing DB.

> **Env note:** the Prisma CLI only auto-loads `.env` (not `.env.local`, which is
> Next.js-only). A symlink `.env -> .env.local` makes `prisma …`, `npm run
> db:migrate`, and `db:studio` all find `DATABASE_URL`. `.env` is gitignored.

---

## One-time: finish the baseline on the live database

Run these **once**, after the database is reachable (if it's Supabase and
paused, resume it from the dashboard first).

```bash
# 1. Record the baseline as already-applied. This does NOT run the 1,000-line
#    0_init SQL — it just writes a row to _prisma_migrations saying the DB is
#    already at that state. (Creates the _prisma_migrations table.)
npx prisma migrate resolve --applied 0_init

# 2. Confirm: 0_init applied, the ERP migration pending.
npx prisma migrate status

# 3. (Safety) Preview exactly what step 4 will change — should match the ERP
#    migration.sql (new TallySyncQueue, Lead.converted* cols, StockMovement
#    ledger cols, indexes/FKs) and touch nothing else.
npx prisma migrate diff --from-database --to-schema-datamodel prisma/schema.prisma --script

# 4. Apply the ERP migration.
npx prisma migrate deploy

# 5. Regenerate the client (migrate deploy does not).
npx prisma generate
```

> ⚠️ **`resolve --applied 0_init` must come first.** If you skip it and run
> `migrate deploy` on a DB that already has the tables, Prisma will try to run
> `0_init` (`CREATE TABLE "Organization" …`) and fail with "already exists".

> ⚠️ **The ERP tables must be empty.** The ERP migration adds `NOT NULL` columns
> to `StockMovement` (and drops its old `type` column). That's safe only because
> those tables have no rows yet. If they ever hold data, add the columns with a
> default or backfill in the migration first.

### Supabase pooler caveat

`DATABASE_URL` points at the Supabase pooler (`…pooler.supabase.com:5432`).
Migrations generally work over the session pooler (port 5432). If `migrate
deploy` hangs on advisory locks or errors, use the **direct** connection string
for migrations (Supabase dashboard → Database → Connection string → "Direct
connection"), or add a `directUrl` to the datasource block and point it there.

---

## Going forward

- **Make schema changes with migrations, not `db push`:**

  ```bash
  # edit prisma/schema.prisma, then:
  npx prisma migrate dev --name <short_change_name>
  ```

  This creates a new `prisma/migrations/<timestamp>_<name>/` folder, applies it
  locally, and regenerates the client. **Commit the migration folder.**

- **Deploy / CI / other environments:** `npx prisma migrate deploy` applies any
  pending migrations (and, on a brand-new DB, runs `0_init` + everything after).

- Prefer `db push` only for throwaway/local scratch databases, never a shared or
  production one.

- Migrations are forward-only. To undo a change, write a new migration that
  reverses it — don't edit an already-applied migration file.

- `prisma/legacy-sql/` is archived reference only; do not run it.

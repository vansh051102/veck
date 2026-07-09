# Legacy hand-written SQL (archived)

These files predate native Prisma Migrate. They were applied by hand / via
`prisma db push` before the project was baselined:

- `0000_baseline.sql` — full schema for a fresh DB
- `0001_phase2_multitenancy.sql` — phase-2 additions
- `0002_phase3_perf.sql` — phase-3 performance indexes

They are **superseded** by the native migration history under
`prisma/migrations/` (the `0_init` baseline captures the same end state). Kept
here for reference only — do not run them. See [docs/database-migrations.md](../../docs/database-migrations.md).

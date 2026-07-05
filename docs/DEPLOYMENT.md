# VECK Deployment Runbook

Target: Vercel + Supabase (Postgres + Auth). Adjust hostnames if self-hosting.

## 1. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (and `.env.local` for dev):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (use the **pooled** connection for serverless) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `CRON_SECRET` | Random string (≥ 32 chars) protecting `/api/v1/cron/*` |
| `INDIAMART_WEBHOOK_SECRET` | URL secret for the IndiaMART webhook |

Never commit secrets. Rotate `CRON_SECRET` if leaked.

## 2. Database

```bash
npx prisma generate
npm run db:push        # applies schema (includes OrgSequence counter table)
```

For production prefer migrations over `db push` once schema stabilizes: `npm run db:migrate`.

## 3. Deploy

```bash
npm run lint && npx tsc --noEmit && npx jest   # must be green
npm run build                                   # must succeed locally
vercel --prod
```

## 4. Scheduled jobs

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/v1/cron/sla-check", "schedule": "*/10 * * * *" },
    { "path": "/api/v1/cron/follow-up-nudges", "schedule": "0 * * * *" }
  ]
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is set. If using an external scheduler, send the same header.

## 5. Post-deploy smoke checks

1. `GET /api/v1/health` → `{ success: true }`.
2. Log in, load `/dashboard` and `/leads` (verifies middleware header forwarding + DB).
3. Create a test lead → confirm the two Step 1 checklists appear.
4. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/v1/cron/sla-check` → 200.
5. Try the same curl **without** the header → 401.

## 6. Rollback

Vercel → Deployments → previous deployment → "Promote to Production". Schema changes are additive so far; if a future migration is destructive, take a Supabase backup first (Database → Backups).

## 7. Monitoring

- Vercel → Logs: watch for 5xx and `Unexpected error` entries (unhandled paths log there).
- Supabase → Database → Query performance for slow queries.
- Set a Vercel uptime/alert integration (or external ping on `/api/v1/health`).

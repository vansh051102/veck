# VECK Deployment Runbook

Target: Vercel + Supabase (Postgres + Auth). Adjust hostnames if self-hosting.

## 1. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (and `.env.local` for dev):

**Required**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (use the **pooled** connection for serverless). Append `?connection_limit=15&pool_timeout=20` — a default connection limit is too small once any route fans out multiple queries per request under concurrent traffic; see `tests/load/k6-baseline.js` for the load test that found this |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin key — never expose to the client |
| `CRON_SECRET` | Random string (≥ 32 chars) protecting `/api/v1/cron/*` |

**Optional**

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Transactional email. Unset ⇒ SLA notification emails silently no-op (`lib/sla-email.ts`) |
| `APP_URL` | Base URL in generated links; defaults to `https://app.veck.in` (`quick-login` magic links) |
| `LOG_LEVEL` | pino level; defaults to `info` in production |

**Must NOT be set in production**

| Variable | Why |
|---|---|
| `DISABLE_AUTH`, `NEXT_PUBLIC_DISABLE_AUTH` | Dev-only auth bypass (`lib/dev-auth.ts`). Setting either to `true` in production disables authentication entirely |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | Local bootstrap credentials only |

Never commit secrets. Rotate `CRON_SECRET` if leaked.

> **Webhook secrets are not environment variables.** Each integration's secret lives per-organization
> in the database (`Settings`), managed at Admin → Workspace → Integrations, and appears in the webhook
> URL path. The `INDIAMART_*` entries still present in `.env.example` are dead config — no code reads them.

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
    { "path": "/api/v1/cron/follow-up-nudges", "schedule": "0 * * * *" },
    { "path": "/api/v1/cron/justdial-poll", "schedule": "*/10 * * * *" }
  ]
}
```

There is currently **no `vercel.json` in the repo** — create it, or configure the same schedules in an external scheduler.

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is set. If using an external scheduler, send the same header.

> `justdial-poll` reads a fixed 20-minute lookback window (`LOOKBACK_MINUTES`). It must run **more often than every 20 minutes** or inbound JustDial leads will be missed.

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

import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { secureEqual } from '@/lib/secure-compare'
import { pollAllOrgs } from '@/lib/integrations/justdial'

// ponytail: lookback window instead of a persisted lastPolledAt cursor —
// simpler, no schema change, safe as long as this runs at least every
// LOOKBACK_MINUTES (dedup via Lead.externalId makes overlap harmless).
// Add a cursor if the polling interval ever needs to shrink below this.
const LOOKBACK_MINUTES = 20

// GET /api/v1/cron/justdial-poll - Pulls new leads from JustDial's Lead
// Manager API for every org that has a key set on the Integrations tab
// (Settings.justdialApiKey) and creates a Contact + Lead for each.
//
// Server-to-server endpoint, intended to be hit on a schedule (Vercel Cron
// or any external scheduler) more often than every LOOKBACK_MINUTES.
// Secured by CRON_SECRET: Authorization: Bearer <CRON_SECRET>
export const GET = withErrorHandler(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    throw new UnauthorizedError('Invalid cron secret')
  }

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000)
  const { results, errors } = await pollAllOrgs(since)

  return successResponse({ polledSince: since.toISOString(), results, errors })
})

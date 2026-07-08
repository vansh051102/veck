import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { TERMINAL_STAGES } from '@/lib/lead-stages'
import { secureEqual } from '@/lib/secure-compare'

// GET /api/v1/cron/sla-check - Flag leads whose SLA deadline has passed.
//
// Server-to-server endpoint, intended to be hit on a schedule (Vercel Cron,
// GitHub Actions, or any external scheduler). Secured by CRON_SECRET:
//   Authorization: Bearer <CRON_SECRET>
// Vercel Cron sends this header automatically when CRON_SECRET is set.
//
// Idempotent: only flips slaBreached false -> true; already-breached and
// terminal-stage leads are untouched.
export const GET = withErrorHandler(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    throw new UnauthorizedError('Invalid cron secret')
  }

  const now = new Date()
  const result = await prisma.lead.updateMany({
    where: {
      slaBreached: false,
      slaDeadline: { lt: now },
      stage: { notIn: [...TERMINAL_STAGES] },
    },
    data: { slaBreached: true },
  })

  return successResponse({ checkedAt: now.toISOString(), newlyBreached: result.count })
})

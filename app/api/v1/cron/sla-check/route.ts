import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { TERMINAL_STAGES } from '@/lib/lead-stages'
import { secureEqual } from '@/lib/secure-compare'

export const GET = withErrorHandler(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    throw new UnauthorizedError('Invalid cron secret')
  }

  const now = new Date()

  // Mark breached leads
  const result = await prisma.lead.updateMany({
    where: {
      slaBreached: false,
      slaDeadline: { lt: now },
      stage: { notIn: [...TERMINAL_STAGES] },
    },
    data: { slaBreached: true },
  })

  // Mark breached SLA clocks and escalate
  const breachedClocks = await prisma.slaClock.findMany({
    where: {
      status: 'pending',
      targetMinutes: { not: null },
      deadline: { lt: now },
    },
    include: { rule: true },
  })

  // Update clock status to breached
  await prisma.slaClock.updateMany({
    where: {
      status: 'pending',
      targetMinutes: { not: null },
      deadline: { lt: now },
    },
    data: { status: 'breached', escalatedAt: now },
  })

  // Escalate breached clocks if rule has escalateToRoleId
  const escalations = breachedClocks
    .filter((c) => c.rule?.escalateToRoleId)
    .map((c) => ({
      slaClockId: c.id,
      leadId: c.entityId,
      escalateToRoleId: c.rule!.escalateToRoleId!,
    }))

  if (escalations.length > 0) {
    // Log escalations (phase 2: send email/slack notifications here)
    console.log(`[SLA] ${escalations.length} breaches escalated`, escalations)
  }

  return successResponse({
    checkedAt: now.toISOString(),
    newlyBreached: result.count,
    clocksBreached: breachedClocks.length,
    escalated: escalations.length,
  })
})

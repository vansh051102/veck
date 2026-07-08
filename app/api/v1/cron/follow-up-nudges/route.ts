import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { FOLLOW_UP_TITLE_PREFIX } from '@/lib/follow-up'
import { secureEqual } from '@/lib/secure-compare'

// GET /api/v1/cron/follow-up-nudges - Flag overdue Quote Sent follow-ups.
//
// For each pending follow-up task past its scheduled time, posts an
// "overdue" event to the lead's timeline (once per task) so the assigned
// rep sees the nudge on the lead detail page. Follow-ups on leads that have
// left Quote Sent are cancelled. Secured like sla-check:
//   Authorization: Bearer <CRON_SECRET>
export const GET = withErrorHandler(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    throw new UnauthorizedError('Invalid cron secret')
  }

  const now = new Date()
  const overdue = await prisma.activity.findMany({
    where: {
      type: 'task',
      status: 'pending',
      title: { startsWith: FOLLOW_UP_TITLE_PREFIX },
      scheduledFor: { lt: now },
    },
    include: { lead: { select: { id: true, companyName: true, stage: true } } },
  })

  let nudged = 0
  let cancelled = 0
  for (const task of overdue) {
    const meta = (task.metadata ?? {}) as Record<string, unknown>
    if (meta.nudged) continue // already flagged on a previous run

    // Leads that left Quote Sent no longer need follow-ups; cancel them.
    if (task.lead.stage !== 'Quote Sent') {
      await prisma.activity.update({ where: { id: task.id }, data: { status: 'cancelled' } })
      cancelled++
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id: task.id },
        data: { metadata: { ...meta, nudged: true } },
      })
      const timeline = await tx.timeline.upsert({
        where: { leadId: task.lead.id },
        create: { leadId: task.lead.id },
        update: {},
      })
      await tx.timelineEvent.create({
        data: {
          timelineId: timeline.id,
          type: 'follow_up_overdue',
          title: `Overdue: ${task.title}`,
          description: `Follow-up for ${task.lead.companyName} was due ${task.scheduledFor?.toISOString()}`,
          createdBy: 'system',
        },
      })
    })
    nudged++
  }

  return successResponse({ checkedAt: now.toISOString(), overdue: overdue.length, nudged, cancelled })
})

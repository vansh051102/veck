// ============================================================================
// QUOTE SENT FOLLOW-UP ENGINE (SOP Step 4)
// ============================================================================
// The SOP mandates a daily follow-up for 6 days after a quote is sent.
// When a lead enters "Quote Sent" we schedule 6 pending task activities,
// one per day. The follow-up nudge cron (app/api/v1/cron/follow-up-nudges)
// flags any that are overdue.

import type { Prisma } from '@prisma/client'

export const FOLLOW_UP_DAYS = 6
export const FOLLOW_UP_TITLE_PREFIX = 'Daily follow-up'

/**
 * Creates the 6-day follow-up schedule for a lead entering Quote Sent.
 * Idempotent: skipped if pending follow-up tasks already exist for the lead.
 */
export async function createFollowUpSchedule(
  tx: Prisma.TransactionClient,
  params: { leadId: string; orgId: string; createdBy: string; from?: Date }
): Promise<number> {
  const { leadId, orgId, createdBy } = params
  const from = params.from ?? new Date()

  const existing = await tx.activity.count({
    where: { leadId, type: 'task', status: 'pending', title: { startsWith: FOLLOW_UP_TITLE_PREFIX } },
  })
  if (existing > 0) return 0

  for (let day = 1; day <= FOLLOW_UP_DAYS; day++) {
    const scheduledFor = new Date(from.getTime() + day * 24 * 60 * 60 * 1000)
    await tx.activity.create({
      data: {
        orgId,
        leadId,
        type: 'task',
        title: `${FOLLOW_UP_TITLE_PREFIX} (day ${day} of ${FOLLOW_UP_DAYS})`,
        description: 'SOP Step 4: call the customer, confirm quote status, record feedback.',
        scheduledFor,
        status: 'pending',
        metadata: { sop: 'QUOTE_SENT_FOLLOW_UP', day },
        createdBy,
      },
    })
  }
  return FOLLOW_UP_DAYS
}

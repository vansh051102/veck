import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { assertTransitionAllowed, calculateSlaDeadline } from '@/lib/workflow'
import { createSopChecklistsForStage } from '@/lib/sop-checklists'
import { createFollowUpSchedule } from '@/lib/follow-up'
import { UpdateLeadStageSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
  extractUserRole,
} from '@/lib/api-response'
import { requirePermission, canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// PUT /api/v1/leads/:id/stage - Move a lead through the workflow, with gating
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.LEADS_EDIT)

  const role = extractUserRole(req.headers)
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = UpdateLeadStageSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid stage change request', parsed.error.flatten())
  }
  const { stage: toStage, reason } = parsed.data
  const fromStage = lead.stage

  // Validates legality of transition + gating rules (activities, checklists, reason)
  await assertTransitionAllowed(lead, toStage, reason)

  const now = new Date()
  const isLossPath = toStage === 'Deal Lost' || toStage === 'Disqualified'

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: toStage,
        stageChangedAt: now,
        stageChangedBy: userId,
        slaCreatedAt: now,
        slaDeadline: calculateSlaDeadline(toStage, now),
        slaBreached: false,
        ...(isLossPath && {
          status: toStage === 'Deal Lost' ? 'closed_lost' : 'disqualified',
          dealLostReason: reason,
          dealLostDate: now,
        }),
        ...(toStage === 'Closed Won' && { status: 'closed_won' }),
      },
    })

    // Auto-create the SOP checklists for the stage being entered
    await createSopChecklistsForStage(tx, lead.id, toStage)

    // SOP Step 4: schedule the 6-day daily follow-up when a quote goes out
    if (toStage === 'Quote Sent') {
      await createFollowUpSchedule(tx, { leadId: lead.id, orgId, createdBy: userId, from: now })
    }

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
    })

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'stage_changed',
        title: `Stage changed: ${fromStage} → ${toStage}`,
        description: reason,
        metadata: { oldStage: fromStage, newStage: toStage, reason },
        createdBy: userId,
      },
    })

    return result
  })

  await logAudit(orgId, userId, 'STAGE_CHANGE', 'Lead', updated.id, updated.companyName, {
    fromStage,
    toStage,
    reason,
  })

  return successResponse(updated)
})

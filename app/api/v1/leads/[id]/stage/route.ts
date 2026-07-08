import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { assertTransitionAllowed, calculateSlaDeadline } from '@/lib/workflow'
import { createSopChecklistsForStage } from '@/lib/sop-checklists'
import { createFollowUpSchedule } from '@/lib/follow-up'
import { UpdateLeadStageSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// PUT /api/v1/leads/:id/stage - Move a lead through the workflow, with gating
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_EDIT
  )

  if (!await canAccessLead(ctx.userId, ctx.role, params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = UpdateLeadStageSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid stage change request', parsed.error.flatten())
  }
  const { stage: toStage, reason, reasonDetails, assignedToId, supplierMargin, quotationNumber, productCategory, quotationValue } = parsed.data
  const fromStage = lead.stage

  // Validates legality of transition + gating rules (activities, checklists, reason)
  assertTransitionAllowed(lead, toStage, reason)

  // Optional handover: assign as part of the transition (marketing → sales
  // at Qualified). Assignee must be an active user in the same org.
  let assignee: { id: string; fullName: string } | null = null
  if (assignedToId) {
    assignee = await prisma.user.findFirst({
      where: { id: assignedToId, orgId: ctx.orgId, status: 'active' },
      select: { id: true, fullName: true },
    })
    if (!assignee) throw new ValidationError('Assignee not found or inactive')
  }

  const now = new Date()
  const isLossPath = toStage === 'Deal Lost' || toStage === 'Disqualified'

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: toStage,
        stageChangedAt: now,
        stageChangedBy: ctx.userId,
        slaCreatedAt: now,
        slaDeadline: calculateSlaDeadline(toStage, now),
        slaBreached: false,
        ...(isLossPath && {
          status: toStage === 'Deal Lost' ? 'closed_lost' : 'disqualified',
          dealLostReason: reason,
          dealLostDetails: reasonDetails || null,
          dealLostDate: now,
        }),
        ...(toStage === 'Closed Won' && { status: 'closed_won' }),
        // Reopening: moving back to any non-terminal stage clears the loss
        // record and reopens the lead (fixes stuck status='closed_lost').
        ...(!isLossPath && toStage !== 'Closed Won' && {
          status: 'open',
          dealLostReason: null,
          dealLostDetails: null,
          dealLostDate: null,
        }),
        ...(assignee && { assignedToId: assignee.id, assignedAt: now }),
        ...(toStage === 'Quote Sent' && {
          supplierMargin,
          quotationNumber,
          productCategory,
          quotationValue,
        }),
        // Stage-entry stamps (set once) for pipeline-velocity metrics.
        ...(toStage === 'Qualified' && !lead.qualifiedAt && { qualifiedAt: now }),
        ...(toStage === 'Quote Sent' && !lead.quoteSentAt && { quoteSentAt: now }),
      },
    })

    // Auto-create the SOP checklists for the stage being entered
    await createSopChecklistsForStage(tx, lead.id, toStage)

    // SOP Step 4: schedule the 6-day daily follow-up when a quote goes out
    if (toStage === 'Quote Sent') {
      await createFollowUpSchedule(tx, { leadId: lead.id, orgId: ctx.orgId, createdBy: ctx.userId, from: now })
    }

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
    })

    // Loss events read like "Lead moved to Deal Lost. [Reason: … | Details: …]"
    const lossDescription = isLossPath
      ? `Lead moved to ${toStage}. [Reason: ${reason}${reasonDetails ? ` | Details: ${reasonDetails}` : ''}]`
      : reason

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'stage_changed',
        title: assignee
          ? `Stage changed: ${fromStage} → ${toStage} · handed over to ${assignee.fullName}`
          : `Stage changed: ${fromStage} → ${toStage}`,
        description: lossDescription,
        metadata: {
          oldStage: fromStage,
          newStage: toStage,
          reason,
          reasonDetails,
          assignedToId: assignee?.id,
        },
        createdBy: ctx.userId,
      },
    })

    return result
  })

  await logAudit(ctx.orgId, ctx.userId, 'STAGE_CHANGE', 'Lead', updated.id, updated.companyName, {
    fromStage,
    toStage,
    reason,
    reasonDetails,
  })

  return successResponse(updated)
})

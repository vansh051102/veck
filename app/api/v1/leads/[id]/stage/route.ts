import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { assertTransitionAllowed } from '@/lib/workflow'
import { startSlaClock, closeOpenSlaClocks } from '@/lib/sla-engine'
import {
  assertRequiredChecklistsComplete,
  createSopChecklistsForStage,
} from '@/lib/sop-checklists'
import { createFollowUpSchedule } from '@/lib/follow-up'
import { UpdateLeadStageSchema } from '@/lib/validation'
import { isWonStage, normalizeStageName, SALES_HANDOVER_ROLES } from '@/lib/lead-stages'
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

  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = UpdateLeadStageSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid stage change request', parsed.error.flatten())
  }
  const {
    stage: rawToStage,
    reason,
    reasonDetails,
    assignedToId,
    supplierMargin,
    quotationNumber,
    productCategory,
    quotationValue,
  } = parsed.data
  const toStage = normalizeStageName(rawToStage)
  const fromStage = normalizeStageName(lead.stage)

  assertTransitionAllowed(lead, toStage, reason, ctx.role)

  // Marketing → Sales handover required when entering Qualified
  const isMarketing = ctx.role.startsWith('marketing')
  if (isMarketing && toStage === 'Qualified' && !assignedToId) {
    throw new ValidationError(
      'Assign a Sales Executive when moving a lead to Qualified (marketing handover)'
    )
  }

  await assertRequiredChecklistsComplete(prisma, lead.id, fromStage, toStage)

  const orgStages = await prisma.settings.findUnique({
    where: { orgId: ctx.orgId },
    select: { workflowStages: true },
  })
  const { normalizeWorkflowStages } = await import('@/lib/workflow-stages')
  const stages = normalizeWorkflowStages(orgStages?.workflowStages)
  const stageDef = stages.find((s) => s.name === toStage)
  const slaHours = stageDef?.slaHours

  let assignee: { id: string; fullName: string; role: string } | null = null
  if (assignedToId) {
    assignee = await prisma.user.findFirst({
      where: { id: assignedToId, orgId: ctx.orgId, status: 'active' },
      select: { id: true, fullName: true, role: true },
    })
    if (!assignee) throw new ValidationError('Assignee not found or inactive')
    if (
      isMarketing &&
      toStage === 'Qualified' &&
      !(SALES_HANDOVER_ROLES as readonly string[]).includes(assignee.role)
    ) {
      throw new ValidationError('Handover assignee must be a Sales role')
    }
  }

  const now = new Date()
  const isLossPath = toStage === 'Deal Lost' || toStage === 'Disqualified'
  const isWon = isWonStage(toStage)
  const isOrderClosed = toStage === 'Order Closed'
  const isReopen = !isLossPath && !isWon && !isOrderClosed

  const updated = await prisma.$transaction(async (tx) => {
    await closeOpenSlaClocks(tx, 'Lead', lead.id, now)
    const { deadline } = await startSlaClock({
      db: tx,
      orgId: ctx.orgId,
      entityType: 'Lead',
      entityId: lead.id,
      stage: toStage,
      trigger: 'stage_entered',
      department: ctx.department,
      startAt: now,
      fallbackHours: slaHours,
    })

    const result = await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: toStage,
        stageChangedAt: now,
        stageChangedBy: ctx.userId,
        slaCreatedAt: now,
        // Terminal stages have no deadline (null); keep a far-future sentinel so
        // the required, non-nullable Lead.slaDeadline column stays satisfied.
        slaDeadline: deadline ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        slaBreached: false,
        ...(isLossPath && {
          status: toStage === 'Deal Lost' ? 'closed_lost' : 'disqualified',
          dealLostReason: reason,
          dealLostDetails: reasonDetails || null,
          dealLostDate: now,
        }),
        ...(isWon && { status: 'closed_won' }),
        ...(isOrderClosed && { status: 'closed_won' }),
        ...(isReopen && {
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
      },
    })

    await createSopChecklistsForStage(tx, lead.id, toStage, ctx.role)

    if (toStage === 'Quote Sent') {
      await createFollowUpSchedule(tx, {
        leadId: lead.id,
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        from: now,
      })
    }

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
    })

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

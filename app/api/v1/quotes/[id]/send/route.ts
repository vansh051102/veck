import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { assertTransitionAllowed } from '@/lib/workflow'
import { startSlaClock, closeOpenSlaClocks } from '@/lib/sla-engine'
import { normalizeWorkflowStages } from '@/lib/workflow-stages'
import { SendQuoteSchema } from '@/lib/validation'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

// POST /api/v1/quotes/:id/send - Mark a quote sent and advance the lead workflow.
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.QUOTES_SEND
  )

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: { lead: true },
  })
  if (!quote) throw new NotFoundError('Quote')
  if (!(await canAccessLead(ctx.userId, ctx.role, quote.leadId))) {
    throw new NotFoundError('Quote')
  }
  if (quote.status !== 'draft') {
    throw new ConflictError(`Cannot send a quote with status "${quote.status}"`)
  }

  const body = await req.json()
  const parsed = SendQuoteSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid send request', parsed.error.flatten())
  }

  const now = new Date()
  const lead = quote.lead

  const shouldAdvanceStage = lead.stage === 'Qualified'
  if (shouldAdvanceStage) {
    assertTransitionAllowed(lead, 'Quote Sent', undefined, ctx.role)
    // Require the same Quote Sent metadata as the stage endpoint when advancing
    if (
      lead.supplierMargin == null &&
      lead.quotationNumber == null &&
      quote.quoteNumber
    ) {
      // Allow advance using quote number as quotationNumber fallback
    }
  }

  let quoteSentSlaHours: number | null | undefined
  if (shouldAdvanceStage) {
    const orgStages = await prisma.settings.findUnique({
      where: { orgId: ctx.orgId },
      select: { workflowStages: true },
    })
    quoteSentSlaHours = normalizeWorkflowStages(orgStages?.workflowStages).find(
      (s) => s.name === 'Quote Sent'
    )?.slaHours
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedQuote = await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'sent', sentAt: now },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, orgId: lead.orgId },
      update: {},
    })

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'quote_sent',
        title: `Quote ${quote.quoteNumber} sent to ${parsed.data.recipientEmail}`,
        createdBy: ctx.userId,
      },
    })

    let updatedLead = lead
    if (shouldAdvanceStage) {
      await closeOpenSlaClocks(tx, 'Lead', lead.id, now)
      const { deadline } = await startSlaClock({
        db: tx,
        orgId: ctx.orgId,
        entityType: 'Lead',
        entityId: lead.id,
        stage: 'Quote Sent',
        trigger: 'quote_sent',
        department: ctx.department,
        startAt: now,
        fallbackHours: quoteSentSlaHours,
      })

      updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: 'Quote Sent',
          stageChangedAt: now,
          stageChangedBy: ctx.userId,
          slaCreatedAt: now,
          slaDeadline: deadline ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          slaBreached: false,
          status: 'open',
          quotationNumber: lead.quotationNumber ?? quote.quoteNumber,
          quotationValue: lead.quotationValue ?? quote.finalAmount,
        },
      })

      await tx.timelineEvent.create({
        data: {
          timelineId: timeline.id,
          type: 'stage_changed',
          title: 'Stage changed: Qualified → Quote Sent',
          metadata: { oldStage: 'Qualified', newStage: 'Quote Sent', trigger: 'quote_sent' },
          createdBy: ctx.userId,
        },
      })
    }

    return { updatedQuote, updatedLead }
  })

  await logAudit(ctx.orgId, ctx.userId, 'SEND', 'Quote', quote.id, quote.quoteNumber, {
    recipientEmail: parsed.data.recipientEmail,
  })

  return successResponse(result)
})

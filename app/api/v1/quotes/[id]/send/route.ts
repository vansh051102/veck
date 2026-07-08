import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { assertTransitionAllowed, calculateSlaDeadline } from '@/lib/workflow'
import { SendQuoteSchema } from '@/lib/validation'
import { PERMISSIONS, canAccessLead } from '@/lib/rbac'
import { createSopChecklistsForStage } from '@/lib/sop-checklists'
import { createFollowUpSchedule } from '@/lib/follow-up'
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
// If the lead is still in "Qualified", this also transitions it to "Quote Sent"
// (subject to the same gating rules as PUT /leads/:id/stage) so sales reps
// don't have to make two separate calls for the common happy path.
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

  if (!await canAccessLead(ctx.userId, ctx.role, quote.leadId)) {
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

  // Only attempt the stage transition if the lead hasn't already moved past
  // Qualified (idempotency: sending a second quote shouldn't re-trigger it).
  const shouldAdvanceStage = lead.stage === 'Qualified'
  if (shouldAdvanceStage) {
    assertTransitionAllowed(lead, 'Quote Sent')
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedQuote = await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'sent', sentAt: now },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
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
      updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: 'Quote Sent',
          stageChangedAt: now,
          stageChangedBy: ctx.userId,
          slaCreatedAt: now,
          slaDeadline: calculateSlaDeadline('Quote Sent', now),
          slaBreached: false,
          ...(!lead.quoteSentAt && { quoteSentAt: now }),
        },
      })

      // SOP Step 4: mirror PUT /leads/:id/stage — create the stage checklists
      // and the 6-day follow-up schedule on the primary quote-send happy path.
      await createSopChecklistsForStage(tx, lead.id, 'Quote Sent')
      await createFollowUpSchedule(tx, { leadId: lead.id, orgId: ctx.orgId, createdBy: ctx.userId, from: now })

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

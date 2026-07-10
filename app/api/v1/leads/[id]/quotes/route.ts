import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { nextQuoteNumber } from '@/lib/numbering'
import { CreateQuoteSchema } from '@/lib/validation'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

function calculateQuoteTotals(items: { quantity: number; price: number; discount: number }[]) {
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const discount = items.reduce((sum, item) => sum + item.discount, 0)
  const finalAmount = Math.max(0, totalAmount - discount)
  return { totalAmount, discount, finalAmount }
}

// POST /api/v1/leads/:id/quotes - Draft a quote for a lead
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.QUOTES_CREATE)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = CreateQuoteSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid quote data', parsed.error.flatten())
  }
  const input = parsed.data
  const { totalAmount, discount, finalAmount } = calculateQuoteTotals(input.items)

  const quote = await prisma.$transaction(async (tx) => {
    const quoteNumber = await nextQuoteNumber(orgId, undefined, tx)

    const created = await tx.quote.create({
      data: {
        orgId,
        leadId: lead.id,
        quoteNumber,
        items: input.items,
        totalAmount,
        discount,
        finalAmount,
        validUntil: input.validUntil,
        terms: input.terms,
        notes: input.notes,
        status: 'draft',
        createdBy: userId,
      },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
    })

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'quote_created',
        title: `Quote ${quoteNumber} drafted`,
        description: `Total: ${finalAmount}`,
        createdBy: userId,
      },
    })

    return created
  })

  await logAudit(orgId, userId, 'CREATE', 'Quote', quote.id, quote.quoteNumber)

  return successResponse(quote, { statusCode: 201 })
})

// GET /api/v1/leads/:id/quotes - List quotes for a lead
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.QUOTES_READ)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const quotes = await prisma.quote.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
  })

  return successResponse(quotes)
})

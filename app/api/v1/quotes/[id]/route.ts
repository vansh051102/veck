import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UpdateQuoteSchema } from '@/lib/validation'
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

function calculateQuoteTotals(items: { quantity: number; price: number; discount: number }[]) {
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const discount = items.reduce((sum, item) => sum + item.discount, 0)
  const finalAmount = Math.max(0, totalAmount - discount)
  return { totalAmount, discount, finalAmount }
}

// GET /api/v1/quotes/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.QUOTES_READ
  )

  const quote = await prisma.quote.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!quote) throw new NotFoundError('Quote')
  if (!(await canAccessLead(ctx.userId, ctx.role, quote.leadId))) {
    throw new NotFoundError('Quote')
  }

  return successResponse(quote)
})

// PUT /api/v1/quotes/:id - Update a draft quote (sent/accepted quotes are locked)
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.QUOTES_EDIT
  )

  const existing = await prisma.quote.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Quote')
  if (!(await canAccessLead(ctx.userId, ctx.role, existing.leadId))) {
    throw new NotFoundError('Quote')
  }
  if (existing.status !== 'draft') {
    throw new ConflictError(`Cannot edit a quote with status "${existing.status}"`)
  }

  const body = await req.json()
  const parsed = UpdateQuoteSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid quote data', parsed.error.flatten())
  }
  const input = parsed.data

  const totals = input.items ? calculateQuoteTotals(input.items) : {}

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data: { ...input, ...totals },
  })

  await logAudit(orgId, userId, 'UPDATE', 'Quote', quote.id, quote.quoteNumber, input)

  return successResponse(quote)
})

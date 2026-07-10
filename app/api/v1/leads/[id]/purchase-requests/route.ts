import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { nextPurchaseRequestNumber } from '@/lib/numbering'
import { CreatePurchaseRequestSchema } from '@/lib/validation'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

// POST /api/v1/leads/:id/purchase-requests - Raise a PR against a lead
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.PURCHASE_REQUESTS_CREATE)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = CreatePurchaseRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid purchase request data', parsed.error.flatten())
  }
  const input = parsed.data

  const pr = await prisma.$transaction(async (tx) => {
    const prNumber = await nextPurchaseRequestNumber(orgId, undefined, tx)

    const created = await tx.purchaseRequest.create({
      data: {
        orgId,
        leadId: lead.id,
        prNumber,
        productIds: input.productIds,
        estimatedQuantity: input.estimatedQuantity,
        estimatedAmount: input.estimatedAmount,
        notes: input.notes,
        status: 'pending',
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
        type: 'purchase_request_created',
        title: `Purchase request ${prNumber} raised`,
        createdBy: userId,
      },
    })

    return created
  })

  await logAudit(orgId, userId, 'CREATE', 'PurchaseRequest', pr.id, pr.prNumber)

  return successResponse(pr, { statusCode: 201 })
})

// GET /api/v1/leads/:id/purchase-requests - List PRs for a lead
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.PURCHASE_REQUESTS_READ)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const purchaseRequests = await prisma.purchaseRequest.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
  })

  return successResponse(purchaseRequests)
})

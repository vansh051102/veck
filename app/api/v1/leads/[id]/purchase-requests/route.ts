import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { nextPurchaseRequestNumber } from '@/lib/numbering'
import { CreatePurchaseRequestSchema } from '@/lib/validation'
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

// POST /api/v1/leads/:id/purchase-requests - Raise a PR against a lead
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.PURCHASE_REQUESTS_CREATE)

  const role = extractUserRole(req.headers)
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
    const prNumber = await nextPurchaseRequestNumber(orgId)

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
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.PURCHASE_REQUESTS_READ)

  const role = extractUserRole(req.headers)
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

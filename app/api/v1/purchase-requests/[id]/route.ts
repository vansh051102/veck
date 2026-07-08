import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UpdatePurchaseRequestSchema } from '@/lib/validation'
import { PERMISSIONS, canAccessLead } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

const PR_STATUSES = ['pending', 'sent_to_supplier', 'received', 'approved'] as const

// GET /api/v1/purchase-requests/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.PURCHASE_REQUESTS_READ)

  const pr = await prisma.purchaseRequest.findFirst({ where: { id: params.id, orgId } })
  if (!pr) throw new NotFoundError('Purchase request')

  if (!await canAccessLead(ctx.userId, ctx.role, pr.leadId)) {
    throw new NotFoundError('Purchase request')
  }

  return successResponse(pr)
})

// PUT /api/v1/purchase-requests/:id - Update PR fields and/or advance status
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.PURCHASE_REQUESTS_EDIT)

  const existing = await prisma.purchaseRequest.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Purchase request')

  if (!await canAccessLead(ctx.userId, ctx.role, existing.leadId)) {
    throw new NotFoundError('Purchase request')
  }

  const body = await req.json()
  const { status, ...rest } = body as { status?: string; [key: string]: unknown }

  if (status !== undefined && !(PR_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`)
  }

  const parsed = UpdatePurchaseRequestSchema.safeParse(rest)
  if (!parsed.success) {
    throw new ValidationError('Invalid purchase request data', parsed.error.flatten())
  }

  const pr = await prisma.purchaseRequest.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      ...(status && {
        status,
        ...(status === 'sent_to_supplier' && { sentToSupplierAt: new Date() }),
      }),
    },
  })

  await logAudit(orgId, userId, 'UPDATE', 'PurchaseRequest', pr.id, pr.prNumber, { status, ...parsed.data })

  return successResponse(pr)
})

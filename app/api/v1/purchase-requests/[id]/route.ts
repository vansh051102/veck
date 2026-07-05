import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { UpdatePurchaseRequestSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
} from '@/lib/api-response'

interface Params {
  params: { id: string }
}

const PR_STATUSES = ['pending', 'sent_to_supplier', 'received', 'approved'] as const

// GET /api/v1/purchase-requests/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const pr = await prisma.purchaseRequest.findFirst({ where: { id: params.id, orgId } })
  if (!pr) throw new NotFoundError('Purchase request')

  return successResponse(pr)
})

// PUT /api/v1/purchase-requests/:id - Update PR fields and/or advance status
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const existing = await prisma.purchaseRequest.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Purchase request')

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

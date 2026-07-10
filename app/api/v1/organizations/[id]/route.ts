import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

const UpdateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  subscriptionPlan: z.string().optional(),
})

function assertOrgAccess(ctx: { role: string; orgId: string }, orgId: string) {
  if (ctx.role !== 'admin' || ctx.orgId !== orgId) {
    throw new ForbiddenError('Admin access required for this organization')
  }
}

// GET /api/v1/organizations/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  assertOrgAccess(ctx, params.id)

  const org = await prisma.organization.findUnique({ where: { id: params.id } })
  if (!org) throw new NotFoundError('Organization')

  return successResponse(org)
})

// PUT /api/v1/organizations/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  assertOrgAccess(ctx, params.id)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.organization.findUnique({ where: { id: params.id } })
  if (!existing) throw new NotFoundError('Organization')

  const body = await req.json()
  const parsed = UpdateOrgSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid organization data', parsed.error.flatten())
  }

  const data = { ...parsed.data }
  if (data.email === '') data.email = null

  const org = await prisma.organization.update({
    where: { id: params.id },
    data,
  })

  return successResponse(org)
})

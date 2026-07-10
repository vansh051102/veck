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
import { z } from 'zod'

interface Params {
  params: { id: string }
}

const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  territory: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  reportsToId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

// GET /api/v1/users/:id - Get a single user
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.USERS_READ)

  const user = await prisma.user.findFirst({
    where: { id: params.id, orgId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      department: true,
      designation: true,
      territory: true,
      branch: true,
      reportsToId: true,
      status: true,
      lastLogin: true,
      createdAt: true,
      directReports: {
        select: { id: true, fullName: true, email: true, role: true },
      },
    },
  })

  if (!user) throw new NotFoundError('User')

  return successResponse(user)
})

// PUT /api/v1/users/:id - Update user role, department, designation, status
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.USERS_EDIT)

  const existing = await prisma.user.findFirst({
    where: { id: params.id, orgId },
  })
  if (!existing) throw new NotFoundError('User')

  const body = await req.json()
  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid user data', parsed.error.flatten())
  }

  if (
    params.id === userId &&
    (parsed.data.role !== undefined || parsed.data.status !== undefined)
  ) {
    throw new ForbiddenError('Cannot modify your own role or status')
  }

  if (parsed.data.reportsToId) {
    if (parsed.data.reportsToId === params.id) {
      throw new ValidationError('User cannot report to themselves')
    }
    const manager = await prisma.user.findFirst({
      where: { id: parsed.data.reportsToId, orgId, status: 'active' },
    })
    if (!manager) throw new ValidationError('Manager not found')
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      department: true,
      designation: true,
      territory: true,
      branch: true,
      reportsToId: true,
      status: true,
    },
  })

  return successResponse(user)
})

// DELETE /api/v1/users/:id - Soft-deactivate user
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.USERS_DELETE)

  if (params.id === userId) {
    throw new ForbiddenError('Cannot deactivate your own account')
  }

  const existing = await prisma.user.findFirst({
    where: { id: params.id, orgId },
  })
  if (!existing) throw new NotFoundError('User')

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { status: 'inactive' },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
    },
  })

  return successResponse(user)
})

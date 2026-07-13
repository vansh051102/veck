import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { isKnownPermission } from '@/lib/permissions'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { z } from 'zod'

interface Params {
  params: { id: string }
}

const UpdateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .refine((perms) => perms.every(isKnownPermission), {
      message: 'One or more permissions are not recognized',
    }),
  description: z.string().nullable().optional(),
  hierarchyLevel: z.number().int().min(0).optional(),
  department: z.string().nullable().optional(),
  parentRoleId: z.string().uuid().nullable().optional(),
})

// GET /api/v1/roles/:id - Get a single role
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ROLES_READ)

  const role = await prisma.role.findFirst({
    where: { id: params.id, orgId },
  })
  if (!role) throw new NotFoundError('Role')

  return successResponse(role)
})

// PUT /api/v1/roles/:id - Update role permissions
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ROLES_EDIT)

  const existing = await prisma.role.findFirst({
    where: { id: params.id, orgId },
  })
  if (!existing) throw new NotFoundError('Role')

  // Prevent editing the admin role's permissions (safety)
  if (existing.name === 'admin') {
    throw new ValidationError('Cannot modify admin role permissions')
  }

  const body = await req.json()
  const parsed = UpdateRoleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid role data', parsed.error.flatten())
  }

  const role = await prisma.role.update({
    where: { id: params.id },
    data: {
      permissions: parsed.data.permissions,
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.hierarchyLevel !== undefined && { hierarchyLevel: parsed.data.hierarchyLevel }),
      ...(parsed.data.department !== undefined && { department: parsed.data.department }),
      ...(parsed.data.parentRoleId !== undefined && { parentRoleId: parsed.data.parentRoleId }),
    },
  })

  return successResponse(role)
})

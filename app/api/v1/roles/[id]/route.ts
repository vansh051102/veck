import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { z } from 'zod'

interface Params {
  params: { id: string }
}

// Only real permission strings are accepted. Wildcards ('*') are implicitly
// rejected because they are not members of PERMISSIONS — admin '*' is granted
// by role name, never stored on a custom role.
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as string[]

const UpdateRoleSchema = z.object({
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .refine((perms) => perms.every((p) => ALL_PERMISSIONS.includes(p)), {
      message: 'Contains an unknown or disallowed permission',
    }),
  description: z.string().nullable().optional(),
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
    },
  })

  return successResponse(role)
})

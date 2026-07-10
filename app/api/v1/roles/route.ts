import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { isKnownPermission } from '@/lib/permissions'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().nullable().optional(),
  permissions: z
    .array(z.string())
    .min(1)
    .refine((p) => p.every(isKnownPermission), { message: 'Unknown permission' }),
  department: z.string().nullable().optional(),
  hierarchyLevel: z.number().int().min(0).default(0),
  parentRoleId: z.string().uuid().nullable().optional(),
})

// GET /api/v1/roles
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ROLES_READ
  )

  const roles = await prisma.role.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { hierarchyLevel: 'desc' },
  })

  const users = await prisma.user.groupBy({
    by: ['role'],
    where: { orgId: ctx.orgId, status: 'active' },
    _count: { _all: true },
  })
  const countByRole = new Map(users.map((u) => [u.role, u._count._all]))

  return successResponse(
    roles.map((r) => ({
      ...r,
      memberCount: countByRole.get(r.name) ?? 0,
    }))
  )
})

// POST /api/v1/roles
export const POST = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ROLES_CREATE
  )

  const body = await req.json()
  const parsed = CreateRoleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid role', parsed.error.flatten())
  }

  const key = parsed.data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_/-]/g, '')

  const role = await prisma.role.create({
    data: {
      orgId: ctx.orgId,
      name: key,
      description: parsed.data.description ?? `Custom role: ${parsed.data.name}`,
      permissions: parsed.data.permissions,
      department: parsed.data.department ?? null,
      hierarchyLevel: parsed.data.hierarchyLevel,
      parentRoleId: parsed.data.parentRoleId ?? null,
    },
  })

  return successResponse(role, { statusCode: 201 })
})

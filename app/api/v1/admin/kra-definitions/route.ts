import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

const CreateKraDefinitionSchema = z.object({
  department: z.string().min(1).nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  metric: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/v1/admin/kra-definitions - List department/role -> KPI metric mappings.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const definitions = await prisma.kraDefinition.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ department: 'asc' }, { createdAt: 'asc' }],
  })
  return successResponse(definitions)
})

// POST /api/v1/admin/kra-definitions - Create a KRA (department/role -> metric) mapping.
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateKraDefinitionSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid KRA definition', parsed.error.flatten())
  }

  const definition = await prisma.kraDefinition.create({
    data: {
      orgId: ctx.orgId,
      ...parsed.data,
      updatedBy: ctx.userId,
    },
  })

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'KraDefinition', definition.id, definition.label)

  return successResponse(definition, { statusCode: 201 })
})

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

const UpdateKraDefinitionSchema = z.object({
  department: z.string().min(1).nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  metric: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  weight: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})

interface Params {
  params: { id: string }
}

// PUT /api/v1/admin/kra-definitions/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.kraDefinition.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('KRA definition')

  const body = await req.json()
  const parsed = UpdateKraDefinitionSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid KRA definition', parsed.error.flatten())
  }

  const definition = await prisma.kraDefinition.update({
    where: { id: params.id },
    data: { ...parsed.data, updatedBy: ctx.userId },
  })

  await logAudit(ctx.orgId, ctx.userId, 'UPDATE', 'KraDefinition', definition.id, definition.label, parsed.data)

  return successResponse(definition)
})

// DELETE /api/v1/admin/kra-definitions/:id
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.kraDefinition.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('KRA definition')

  await prisma.kraDefinition.delete({ where: { id: params.id } })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'KraDefinition', existing.id, existing.label)

  return successResponse({ id: existing.id, deleted: true })
})

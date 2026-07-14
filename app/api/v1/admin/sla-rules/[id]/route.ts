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

const UpdateSlaRuleSchema = z.object({
  department: z.string().min(1).nullable().optional(),
  stage: z.string().min(1).optional(),
  trigger: z.string().min(1).optional(),
  targetMinutes: z.number().int().positive().nullable().optional(),
  warningPct: z.number().int().min(1).max(100).optional(),
  calendarId: z.string().uuid().nullable().optional(),
  escalateToRoleId: z.string().uuid().nullable().optional(),
  notifyOnWarning: z.boolean().optional(),
  notifyOnBreach: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

interface Params {
  params: { id: string }
}

// PUT /api/v1/admin/sla-rules/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.slaRule.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!existing) throw new NotFoundError('SLA rule')

  const body = await req.json()
  const parsed = UpdateSlaRuleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid SLA rule', parsed.error.flatten())
  }

  const rule = await prisma.slaRule.update({
    where: { id: params.id },
    data: { ...parsed.data, updatedBy: ctx.userId },
  })

  await logAudit(ctx.orgId, ctx.userId, 'UPDATE', 'SlaRule', rule.id, `${rule.stage}/${rule.trigger}`, parsed.data)

  return successResponse(rule)
})

// DELETE /api/v1/admin/sla-rules/:id
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.slaRule.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!existing) throw new NotFoundError('SLA rule')

  await prisma.slaRule.delete({ where: { id: params.id } })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'SlaRule', existing.id, `${existing.stage}/${existing.trigger}`)

  return successResponse({ id: existing.id, deleted: true })
})

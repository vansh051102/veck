import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UpdateAssignmentRuleSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// PUT /api/v1/assignment-rules/:id - Update a rule (toggle active, change assignee, etc.)
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.assignmentRule.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Assignment rule')

  const body = await req.json()
  const parsed = UpdateAssignmentRuleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment rule', parsed.error.flatten())
  }

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: parsed.data.assignedToId, orgId: ctx.orgId, status: 'active' },
      select: { id: true },
    })
    if (!assignee) throw new ValidationError('Assignee not found or inactive')
  }

  const rule = await prisma.assignmentRule.update({
    where: { id: params.id },
    data: parsed.data,
  })

  await logAudit(ctx.orgId, ctx.userId, 'UPDATE', 'AssignmentRule', rule.id, rule.source, parsed.data)

  return successResponse(rule)
})

// DELETE /api/v1/assignment-rules/:id - Remove a rule
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.assignmentRule.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Assignment rule')

  await prisma.assignmentRule.delete({ where: { id: params.id } })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'AssignmentRule', existing.id, existing.source)

  return successResponse({ id: existing.id, deleted: true })
})

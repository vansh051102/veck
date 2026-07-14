import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

const CreateSlaRuleSchema = z.object({
  entityType: z.string().min(1).default('Lead'),
  department: z.string().min(1).nullable().optional(),
  stage: z.string().min(1),
  trigger: z.string().min(1),
  targetMinutes: z.number().int().positive().nullable().optional(),
  warningPct: z.number().int().min(1).max(100).optional(),
  calendarId: z.string().uuid().nullable().optional(),
  escalateToRoleId: z.string().uuid().nullable().optional(),
  notifyOnWarning: z.boolean().optional(),
  notifyOnBreach: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/v1/admin/sla-rules - List SLA rules for the org.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const rules = await prisma.slaRule.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ stage: 'asc' }, { department: 'asc' }],
  })
  return successResponse(rules)
})

// POST /api/v1/admin/sla-rules - Create an SLA rule (department/stage/trigger scoped target).
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateSlaRuleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid SLA rule', parsed.error.flatten())
  }

  const rule = await prisma.slaRule.create({
    data: {
      orgId: ctx.orgId,
      ...parsed.data,
      updatedBy: ctx.userId,
    },
  })

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'SlaRule', rule.id, `${rule.stage}/${rule.trigger}`)

  return successResponse(rule, { statusCode: 201 })
})

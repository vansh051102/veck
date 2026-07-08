import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { CreateAssignmentRuleSchema } from '@/lib/validation'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

// Assignment rules are a workspace-wide admin concern, gated on settings:edit
// (which only the admin role holds via its wildcard). They are NOT lead-scoped.

// GET /api/v1/assignment-rules - List all auto-assignment rules for the org,
// enriched with the assignee's name for display.
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const rules = await prisma.assignmentRule.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  const assigneeIds = [...new Set(rules.map((r) => r.assignedToId))]
  const users = await prisma.user.findMany({
    where: { id: { in: assigneeIds }, orgId: ctx.orgId },
    select: { id: true, fullName: true, email: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  const data = rules.map((r) => ({
    ...r,
    assignedTo: userById.get(r.assignedToId) ?? null,
  }))

  return successResponse(data)
})

// POST /api/v1/assignment-rules - Create a new auto-assignment rule
export const POST = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateAssignmentRuleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment rule', parsed.error.flatten())
  }

  // Assignee must be an active user in the same org.
  const assignee = await prisma.user.findFirst({
    where: { id: parsed.data.assignedToId, orgId: ctx.orgId, status: 'active' },
    select: { id: true },
  })
  if (!assignee) throw new ValidationError('Assignee not found or inactive')

  const rule = await prisma.assignmentRule.create({
    data: {
      orgId: ctx.orgId,
      source: parsed.data.source,
      weekday: parsed.data.weekday,
      productCategory: parsed.data.productCategory,
      assignedToId: parsed.data.assignedToId,
      isActive: parsed.data.isActive,
      priority: parsed.data.priority,
      createdBy: ctx.userId,
    },
  })

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'AssignmentRule', rule.id, rule.source)

  return successResponse(rule, { statusCode: 201 })
})

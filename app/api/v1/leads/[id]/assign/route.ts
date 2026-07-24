import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { AssignLeadSchema } from '@/lib/validation'
import { StaleVersionError } from '@/lib/errors'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

// PUT /api/v1/leads/:id/assign - Assign a lead to a user
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.LEADS_ASSIGN)

  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = AssignLeadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment request', parsed.error.flatten())
  }
  const { assignedToId, version: clientVersion } = parsed.data

  // Optimistic lock: advisory read-then-write check (see leads/[id]/route.ts).
  if (clientVersion !== undefined && clientVersion !== lead.version) {
    throw new StaleVersionError(lead)
  }

  const assignee = await prisma.user.findFirst({
    where: { id: assignedToId, orgId, status: 'active' },
  })
  if (!assignee) throw new NotFoundError('User')

  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id: lead.id },
      data: { assignedToId, assignedAt: now, version: { increment: 1 } },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, orgId: lead.orgId },
      update: {},
    })

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'assigned',
        title: `Lead assigned to ${assignee.fullName}`,
        createdBy: userId,
      },
    })

    return result
  })

  await logAudit(orgId, userId, 'ASSIGN', 'Lead', updated.id, updated.companyName, { assignedToId })

  return successResponse(updated)
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { AssignLeadSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
} from '@/lib/api-response'

interface Params {
  params: { id: string }
}

// PUT /api/v1/leads/:id/assign - Assign a lead to a user
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = AssignLeadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment request', parsed.error.flatten())
  }
  const { assignedToId } = parsed.data

  const assignee = await prisma.user.findFirst({ where: { id: assignedToId, orgId } })
  if (!assignee) throw new NotFoundError('User')

  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id: lead.id },
      data: { assignedToId, assignedAt: now },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
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

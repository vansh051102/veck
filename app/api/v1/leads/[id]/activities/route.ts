import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { CreateActivitySchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
  extractUserRole,
} from '@/lib/api-response'
import { requirePermission, canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// POST /api/v1/leads/:id/activities - Log a call/email/note/meeting/task against a lead
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.ACTIVITIES_CREATE)

  const role = extractUserRole(req.headers)
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = CreateActivitySchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid activity data', parsed.error.flatten())
  }
  const input = parsed.data
  const now = new Date()

  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        orgId,
        leadId: lead.id,
        type: input.type,
        title: input.title,
        description: input.description,
        scheduledFor: input.scheduledFor,
        duration: input.duration,
        status: input.status,
        metadata: input.metadata,
        createdBy: userId,
        // Activities logged as already-happened (call/note/email without a
        // future scheduledFor) are marked completed immediately.
        completedAt: input.status === 'completed' ? now : null,
      },
    })

    // Completed calls update the lead's contact outcome, which drives the
    // marketing Connected / Not Received tabs.
    const callOutcome =
      input.type === 'call' && input.status === 'completed'
        ? (input.metadata as Record<string, unknown> | undefined)?.outcome
        : undefined
    const contactOutcome =
      callOutcome === undefined
        ? undefined
        : callOutcome === 'connected'
        ? 'connected'
        : 'not_received'

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lastActivityAt: now,
        firstResponseAt: lead.firstResponseAt ?? now,
        ...(contactOutcome && { contactOutcome }),
      },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id },
      update: {},
    })

    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'activity_added',
        title: `${input.type[0].toUpperCase()}${input.type.slice(1)} logged: ${input.title}`,
        description: input.description,
        metadata: { activityType: input.type },
        createdBy: userId,
      },
    })

    return created
  })

  await logAudit(orgId, userId, 'CREATE', 'Activity', activity.id, activity.title)

  return successResponse(activity, { statusCode: 201 })
})

// GET /api/v1/leads/:id/activities - List activities for a lead
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.ACTIVITIES_READ)

  const role = extractUserRole(req.headers)
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const activities = await prisma.activity.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
  })

  return successResponse(activities)
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { UpdateActivitySchema } from '@/lib/validation'
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

// PUT /api/v1/activities/:id - Update an activity
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const existing = await prisma.activity.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Activity')

  const body = await req.json()
  const parsed = UpdateActivitySchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid activity data', parsed.error.flatten())
  }
  const input = parsed.data

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...input,
      ...(input.status === 'completed' &&
        existing.status !== 'completed' && { completedAt: new Date() }),
    },
  })

  await logAudit(orgId, userId, 'UPDATE', 'Activity', activity.id, activity.title, input)

  return successResponse(activity)
})

// DELETE /api/v1/activities/:id - Delete an activity
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const existing = await prisma.activity.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Activity')

  await prisma.activity.delete({ where: { id: params.id } })

  await logAudit(orgId, userId, 'DELETE', 'Activity', existing.id, existing.title)

  return successResponse({ id: existing.id, deleted: true })
})

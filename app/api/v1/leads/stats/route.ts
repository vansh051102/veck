import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, UnauthorizedError, extractOrgAndUserIds } from '@/lib/api-response'

// GET /api/v1/leads/stats - Aggregate counts for the dashboard metric cards
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [total, byStage, slaBreached, open, hot, wonThisMonth] = await Promise.all([
    prisma.lead.count({ where: { orgId } }),
    prisma.lead.groupBy({ by: ['stage'], where: { orgId }, _count: { _all: true } }),
    prisma.lead.count({ where: { orgId, slaBreached: true, status: 'open' } }),
    prisma.lead.count({ where: { orgId, status: 'open' } }),
    prisma.lead.count({ where: { orgId, status: 'open', priority: { in: ['High', 'Urgent'] } } }),
    prisma.lead.count({
      where: { orgId, stage: 'Closed Won', stageChangedAt: { gte: monthStart } },
    }),
  ])

  return successResponse({
    total,
    open,
    hot,
    wonThisMonth,
    slaBreached,
    byStage: Object.fromEntries(byStage.map((s) => [s.stage, s._count._all])),
  })
})

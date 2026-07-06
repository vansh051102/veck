import { prisma } from '@/lib/db'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  extractOrgAndUserIds,
  extractUserRole,
} from '@/lib/api-response'

// GET /api/v1/analytics - Aggregated KPIs, stage distribution, per-salesperson
// stats, and 30-day activity volume.
// Role-scoped: sales/purchase roles see only their own data; admin/manager see all.
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  const role = extractUserRole(req.headers) ?? 'user'

  const isSelf = role !== 'admin' && role !== 'manager'
  const leadsWhere = {
    orgId,
    ...(isSelf && { assignedToId: userId }),
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Run all queries in parallel
  const [
    totalLeads,
    openLeads,
    wonLeads,
    slaBreachedLeads,
    leadsByStage,
    orgUsers,
    recentActivities,
  ] = await Promise.all([
    prisma.lead.count({ where: leadsWhere }),
    prisma.lead.count({
      where: { ...leadsWhere, stage: { notIn: ['Closed Won', 'Deal Lost', 'Disqualified'] } },
    }),
    prisma.lead.count({ where: { ...leadsWhere, stage: 'Closed Won' } }),
    prisma.lead.count({ where: { ...leadsWhere, slaBreached: true } }),
    prisma.lead.groupBy({
      by: ['stage'],
      where: leadsWhere,
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { orgId, status: 'active' },
      select: { id: true, fullName: true, role: true },
    }),
    prisma.activity.findMany({
      where: {
        orgId,
        createdAt: { gte: thirtyDaysAgo },
        ...(isSelf && { createdBy: userId }),
      },
      select: { type: true, createdAt: true },
    }),
  ])

  // Per-salesperson stats
  const salespeople = isSelf
    ? orgUsers.filter((u) => u.id === userId)
    : orgUsers

  const salespersonStats = await Promise.all(
    salespeople.map(async (user) => {
      const [assigned, won, activities] = await Promise.all([
        prisma.lead.count({ where: { orgId, assignedToId: user.id } }),
        prisma.lead.count({ where: { orgId, assignedToId: user.id, stage: 'Closed Won' } }),
        prisma.activity.count({ where: { orgId, createdBy: user.id } }),
      ])
      return {
        userId: user.id,
        name: user.fullName,
        role: user.role,
        leadsAssigned: assigned,
        leadsWon: won,
        conversionRate: assigned > 0 ? Math.round((won / assigned) * 100) : 0,
        activitiesLogged: activities,
      }
    })
  )

  // Activity volume by day for last 30 days
  const activityByDay: Record<string, Record<string, number>> = {}
  for (const activity of recentActivities) {
    const day = activity.createdAt.toISOString().slice(0, 10) // YYYY-MM-DD
    if (!activityByDay[day]) activityByDay[day] = {}
    activityByDay[day][activity.type] = (activityByDay[day][activity.type] ?? 0) + 1
  }

  const activityVolume = Object.entries(activityByDay)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Stage distribution as a flat map
  const stageDistribution: Record<string, number> = {}
  for (const row of leadsByStage) {
    stageDistribution[row.stage] = row._count.id
  }

  return successResponse({
    kpis: {
      totalLeads,
      openLeads,
      wonLeads,
      slaBreached: slaBreachedLeads,
    },
    stageDistribution,
    salespersonStats,
    activityVolume,
  })
})

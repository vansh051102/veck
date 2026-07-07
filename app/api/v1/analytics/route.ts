import { prisma } from '@/lib/db'
import { PERMISSIONS, buildOwnershipFilter } from '@/lib/rbac'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

// GET /api/v1/analytics - Aggregated KPIs, stage distribution, per-salesperson
// stats, and 30-day activity volume.
// Role-scoped: sales/purchase roles see only their own data; admin/manager see all.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ANALYTICS_READ)
  const role = ctx.role
  const department = ctx.department

  const ownershipFilter = buildOwnershipFilter(userId, role, department, 'leads')
  const leadsWhere = {
    orgId,
    ...ownershipFilter,
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
        ...buildOwnershipFilter(userId, role, department, 'activities'),
      },
      select: { type: true, createdAt: true },
    }),
  ])

  // Per-salesperson stats. Team-wide numbers are admin-only: everyone else
  // sees only their own row, so reps can't browse colleagues' performance.
  const statsUsers = role === 'admin' ? orgUsers : orgUsers.filter((u) => u.id === userId)
  const salespersonStats = await Promise.all(
    statsUsers.map(async (user) => {
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
    scope: role === 'admin' ? 'team' : 'own',
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

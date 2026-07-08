import { prisma } from '@/lib/db'
import { buildOwnershipFilter } from '@/lib/rbac'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

// Averages the Qualified -> Quote Sent gap across the org from the per-lead
// stage-entry stamps (Lead.qualifiedAt / Lead.quoteSentAt, set once on first
// entry to each stage). Bounded + indexed (orgId), so it stays cheap on the
// dashboard path instead of scanning the whole audit log. Org-wide: the stamps
// survive the lead moving past Quote Sent (e.g. to Closed Won).
async function computeAvgQualifiedToQuoteSentHours(orgId: string): Promise<number | null> {
  const leads = await prisma.lead.findMany({
    where: { orgId, qualifiedAt: { not: null }, quoteSentAt: { not: null } },
    select: { qualifiedAt: true, quoteSentAt: true },
  })

  const diffsHours: number[] = []
  for (const lead of leads) {
    if (!lead.qualifiedAt || !lead.quoteSentAt) continue
    const hours = (lead.quoteSentAt.getTime() - lead.qualifiedAt.getTime()) / (1000 * 60 * 60)
    if (hours >= 0) diffsHours.push(hours)
  }

  if (diffsHours.length === 0) return null
  return Math.round((diffsHours.reduce((a, b) => a + b, 0) / diffsHours.length) * 10) / 10
}

// GET /api/v1/leads/stats - Aggregate counts for the dashboard metric cards.
// Ownership-filtered like /api/v1/analytics, plus role-specific extras
// consumed by the per-role dashboards under app/(app)/dashboards/.
// Admin may pass ?viewAsUserId=<id> to see stats scoped to another user's role.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  const url = new URL(req.url)
  const viewAsUserId = url.searchParams.get('viewAsUserId')

  // Resolve the effective user context: if admin is impersonating, scope to that user
  let userId = ctx.userId
  let role = ctx.role
  let department: string | null = ctx.department

  if (viewAsUserId && ctx.role === 'admin') {
    const viewAsUser = await prisma.user.findFirst({
      where: { id: viewAsUserId, orgId },
      select: { id: true, role: true, department: true },
    })
    if (viewAsUser) {
      userId = viewAsUser.id
      role = viewAsUser.role
      department = viewAsUser.department
    }
  }

  const ownershipFilter = buildOwnershipFilter(userId, role, department, 'leads')
  const leadsWhere = { orgId, ...ownershipFilter }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [total, byStage, slaBreached, open, hot, wonThisMonth, connected] = await Promise.all([
    prisma.lead.count({ where: leadsWhere }),
    prisma.lead.groupBy({ by: ['stage'], where: leadsWhere, _count: { _all: true } }),
    prisma.lead.count({ where: { ...leadsWhere, slaBreached: true, status: 'open' } }),
    prisma.lead.count({ where: { ...leadsWhere, status: 'open' } }),
    prisma.lead.count({ where: { ...leadsWhere, status: 'open', priority: { in: ['High', 'Urgent'] } } }),
    prisma.lead.count({
      where: { ...leadsWhere, stage: 'Closed Won', stageChangedAt: { gte: monthStart } },
    }),
    prisma.lead.count({
      where: { ...leadsWhere, stage: 'Contacted', contactOutcome: 'connected' },
    }),
  ])

  const byStageMap = Object.fromEntries(byStage.map((s) => [s.stage, s._count._all]))

  const stats: Record<string, unknown> = {
    total,
    open,
    hot,
    wonThisMonth,
    slaBreached,
    byStage: byStageMap,
    // Connected vs Not Received split within Contacted (marketing tabs)
    contactOutcome: {
      connected,
      notReceived: (byStageMap['Contacted'] ?? 0) - connected,
    },
  }

  if (role === 'marketing_manager' || role === 'marketing_executive') {
    stats.contactedCount = byStageMap['Contacted'] ?? 0
    stats.qualifiedCount = byStageMap['Qualified'] ?? 0
    stats.newLeadCount = byStageMap['New Lead'] ?? 0
  }

  if (role === 'sales_manager' || role === 'sales_executive' || role === 'sales_purchase') {
    const [activitiesThisWeek, openLeadsForAging] = await Promise.all([
      prisma.activity.count({
        where: {
          orgId,
          createdAt: { gte: weekStart },
          ...buildOwnershipFilter(userId, role, department, 'activities'),
        },
      }),
      prisma.lead.findMany({ where: { ...leadsWhere, status: 'open' }, select: { createdAt: true } }),
    ])

    const now = Date.now()
    const dealAgingBuckets = { '0-7d': 0, '8-30d': 0, '30d+': 0 }
    for (const lead of openLeadsForAging) {
      const ageDays = (now - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays <= 7) dealAgingBuckets['0-7d']++
      else if (ageDays <= 30) dealAgingBuckets['8-30d']++
      else dealAgingBuckets['30d+']++
    }

    stats.activitiesThisWeek = activitiesThisWeek
    stats.dealAgingBuckets = dealAgingBuckets
  }

  if (role === 'purchase' || role === 'sales_purchase') {
    stats.avgQualifiedToQuoteSentHours = await computeAvgQualifiedToQuoteSentHours(orgId)
  }

  // Admin: recent quotation changes (leads that moved to Quote Sent this week)
  if (role === 'admin') {
    const recentQuoteSents = await prisma.lead.findMany({
      where: {
        orgId,
        stage: 'Quote Sent',
        stageChangedAt: { gte: weekStart },
      },
      select: {
        id: true,
        companyName: true,
        quotationNumber: true,
        quotationValue: true,
        supplierMargin: true,
        productCategory: true,
        stageChangedAt: true,
        assignedTo: { select: { fullName: true } },
      },
      orderBy: { stageChangedAt: 'desc' },
      take: 10,
    })
    stats.recentQuoteSents = recentQuoteSents
  }

  return successResponse(stats)
})

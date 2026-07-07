import { prisma } from '@/lib/db'
import { buildOwnershipFilter } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  extractOrgAndUserIds,
  extractUserRole,
  extractUserDepartment,
} from '@/lib/api-response'

// Averages the Qualified -> Quote Sent gap across the org from STAGE_CHANGE
// audit entries (lib/auth.ts logAudit, written by the stage-change route).
// Org-wide rather than ownership-filtered: this is a pipeline-velocity
// metric, not per-user data, and a lead's history survives it moving past
// Quote Sent (e.g. to Closed Won), which a current-stage filter would miss.
async function computeAvgQualifiedToQuoteSentHours(orgId: string): Promise<number | null> {
  const events = await prisma.auditLog.findMany({
    where: { orgId, resourceType: 'Lead', action: 'STAGE_CHANGE' },
    select: { resourceId: true, changes: true, timestamp: true },
    orderBy: { timestamp: 'asc' },
  })

  const enteredQualified = new Map<string, Date>()
  const enteredQuoteSent = new Map<string, Date>()
  for (const event of events) {
    const changes = event.changes as { toStage?: string } | null
    if (changes?.toStage === 'Qualified' && !enteredQualified.has(event.resourceId)) {
      enteredQualified.set(event.resourceId, event.timestamp)
    }
    if (changes?.toStage === 'Quote Sent' && !enteredQuoteSent.has(event.resourceId)) {
      enteredQuoteSent.set(event.resourceId, event.timestamp)
    }
  }

  const diffsHours: number[] = []
  for (const [leadId, quoteSentAt] of enteredQuoteSent) {
    const qualifiedAt = enteredQualified.get(leadId)
    if (!qualifiedAt) continue
    const hours = (quoteSentAt.getTime() - qualifiedAt.getTime()) / (1000 * 60 * 60)
    if (hours >= 0) diffsHours.push(hours)
  }

  if (diffsHours.length === 0) return null
  return Math.round((diffsHours.reduce((a, b) => a + b, 0) / diffsHours.length) * 10) / 10
}

// GET /api/v1/leads/stats - Aggregate counts for the dashboard metric cards.
// Ownership-filtered like /api/v1/analytics, plus role-specific extras
// consumed by the per-role dashboards under app/(app)/dashboards/.
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  const role = extractUserRole(req.headers) ?? 'admin'
  const department = extractUserDepartment(req.headers)

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

  return successResponse(stats)
})

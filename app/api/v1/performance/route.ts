import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

// Resolves the ?days=7|30|90 / ?from=&to= query params (same convention as
// the leads list filter) into a concrete [start, end) window. No params at
// all means "all time" — start is left undefined.
function resolveCallWindow(url: URL): { start?: Date; end: Date } {
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const days = url.searchParams.get('days')
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date()

  if (from) return { start: new Date(`${from}T00:00:00.000Z`), end }
  if (days && /^\d+$/.test(days)) {
    return { start: new Date(end.getTime() - Number(days) * 24 * 60 * 60 * 1000), end }
  }
  return { end }
}

// GET /api/v1/performance - Performance stats for the Performance page.
//
// Deliberately NOT gated on analytics:read: every user may see their OWN
// numbers. Team-wide stats are returned only for admins (scope: "team");
// everyone else gets exactly one row - their own (scope: "own").
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  const role = ctx.role
  const isAdmin = role === 'admin'

  const users = isAdmin
    ? await prisma.user.findMany({
        where: { orgId, status: 'active' },
        select: { id: true, fullName: true, role: true },
      })
    : await prisma.user.findMany({
        where: { orgId, id: userId },
        select: { id: true, fullName: true, role: true },
      })

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { start: callStart, end: callEnd } = resolveCallWindow(new URL(req.url))
  const callWhere = {
    orgId,
    type: 'call',
    createdAt: { ...(callStart && { gte: callStart }), lte: callEnd },
  }

  const userIds = users.map((u) => u.id)

  // A fixed number of groupBy queries (independent of user count) replaces the
  // previous 7-queries-per-user N+1. Call tallies come from a single fetch.
  const [
    assignedRows,
    openRows,
    wonRows,
    wonThisMonthRows,
    slaBreachedRows,
    activityRows,
    allCalls,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ['assignedToId'], where: { orgId, assignedToId: { in: userIds } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['assignedToId'], where: { orgId, assignedToId: { in: userIds }, status: 'open' }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['assignedToId'], where: { orgId, assignedToId: { in: userIds }, stage: 'Closed Won' }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['assignedToId'], where: { orgId, assignedToId: { in: userIds }, stage: 'Closed Won', stageChangedAt: { gte: monthStart } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['assignedToId'], where: { orgId, assignedToId: { in: userIds }, slaBreached: true, status: 'open' }, _count: { _all: true } }),
    prisma.activity.groupBy({ by: ['createdBy'], where: { orgId, createdBy: { in: userIds } }, _count: { _all: true } }),
    prisma.activity.findMany({
      where: { ...callWhere, createdBy: { in: userIds } },
      select: { createdBy: true, createdAt: true, status: true, metadata: true },
    }),
  ])

  const toMap = (rows: { assignedToId: string | null; _count: { _all: number } }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.assignedToId) m.set(r.assignedToId, r._count._all)
    return m
  }
  const assignedMap = toMap(assignedRows)
  const openMap = toMap(openRows)
  const wonMap = toMap(wonRows)
  const wonThisMonthMap = toMap(wonThisMonthRows)
  const slaBreachedMap = toMap(slaBreachedRows)
  const activityMap = new Map<string, number>()
  for (const r of activityRows) if (r.createdBy) activityMap.set(r.createdBy, r._count._all)

  interface CallTally { total: number; connected: number; notReceived: number }
  const callTally = new Map<string, CallTally>()
  for (const call of allCalls) {
    const t = callTally.get(call.createdBy) ?? { total: 0, connected: 0, notReceived: 0 }
    t.total += 1
    if (call.status === 'completed') {
      const outcome = (call.metadata as { outcome?: string } | null)?.outcome
      if (outcome === 'connected') t.connected += 1
      else t.notReceived += 1
    }
    callTally.set(call.createdBy, t)
  }

  const stats = users.map((user) => {
    const assigned = assignedMap.get(user.id) ?? 0
    const won = wonMap.get(user.id) ?? 0
    const calls = callTally.get(user.id) ?? { total: 0, connected: 0, notReceived: 0 }
    return {
      userId: user.id,
      name: user.fullName,
      role: user.role,
      leadsAssigned: assigned,
      openLeads: openMap.get(user.id) ?? 0,
      leadsWon: won,
      wonThisMonth: wonThisMonthMap.get(user.id) ?? 0,
      slaBreached: slaBreachedMap.get(user.id) ?? 0,
      conversionRate: assigned > 0 ? Math.round((won / assigned) * 100) : 0,
      activitiesLogged: activityMap.get(user.id) ?? 0,
      calls,
    }
  })

  // Per-day call breakdown across whichever users are in scope (own or team).
  const byDay: Record<string, { total: number; connected: number; notReceived: number }> = {}
  for (const call of allCalls) {
    const day = call.createdAt.toISOString().slice(0, 10)
    if (!byDay[day]) byDay[day] = { total: 0, connected: 0, notReceived: 0 }
    byDay[day].total += 1
    if (call.status === 'completed') {
      const outcome = (call.metadata as { outcome?: string } | null)?.outcome
      if (outcome === 'connected') byDay[day].connected += 1
      else byDay[day].notReceived += 1
    }
  }
  const callsByDay = Object.entries(byDay)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return successResponse({
    scope: isAdmin ? 'team' : 'own',
    stats,
    calls: {
      total: allCalls.length,
      connected: callsByDay.reduce((s, d) => s + d.connected, 0),
      notReceived: callsByDay.reduce((s, d) => s + d.notReceived, 0),
      byDay: callsByDay,
    },
  })
})

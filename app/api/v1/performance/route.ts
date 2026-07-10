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

  const stats = await Promise.all(
    users.map(async (user) => {
      const [assigned, open, won, wonThisMonth, slaBreached, activities, calls] = await Promise.all([
        prisma.lead.count({ where: { orgId, assignedToId: user.id } }),
        prisma.lead.count({ where: { orgId, assignedToId: user.id, status: 'open' } }),
        prisma.lead.count({
          where: {
            orgId,
            assignedToId: user.id,
            stage: { in: ['Order Confirmed', 'Order Closed', 'Closed Won'] },
          },
        }),
        prisma.lead.count({
          where: {
            orgId,
            assignedToId: user.id,
            stage: { in: ['Order Confirmed', 'Order Closed', 'Closed Won'] },
            stageChangedAt: { gte: monthStart },
          },
        }),
        prisma.lead.count({
          where: { orgId, assignedToId: user.id, slaBreached: true, status: 'open' },
        }),
        prisma.activity.count({ where: { orgId, createdBy: user.id } }),
        prisma.activity.findMany({
          where: { ...callWhere, createdBy: user.id },
          select: { createdAt: true, status: true, metadata: true },
        }),
      ])

      const connected = calls.filter(
        (c) => c.status === 'completed' && (c.metadata as { outcome?: string } | null)?.outcome === 'connected'
      ).length
      const notReceived = calls.filter(
        (c) =>
          c.status === 'completed' && (c.metadata as { outcome?: string } | null)?.outcome !== 'connected'
      ).length

      return {
        userId: user.id,
        name: user.fullName,
        role: user.role,
        leadsAssigned: assigned,
        openLeads: open,
        leadsWon: won,
        wonThisMonth,
        slaBreached,
        conversionRate: assigned > 0 ? Math.round((won / assigned) * 100) : 0,
        activitiesLogged: activities,
        calls: {
          total: calls.length,
          connected,
          notReceived,
        },
      }
    })
  )

  // Per-day call breakdown across whichever users are in scope (own or team).
  const allCalls = await prisma.activity.findMany({
    where: { ...callWhere, createdBy: { in: users.map((u) => u.id) } },
    select: { createdAt: true, status: true, metadata: true },
  })
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

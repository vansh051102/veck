import { prisma } from '@/lib/db'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  extractOrgAndUserIds,
  extractUserRole,
} from '@/lib/api-response'

// GET /api/v1/performance - Performance stats for the Performance page.
//
// Deliberately NOT gated on analytics:read: every user may see their OWN
// numbers. Team-wide stats are returned only for admins (scope: "team");
// everyone else gets exactly one row - their own (scope: "own").
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  const role = extractUserRole(req.headers) ?? 'user'
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

  const stats = await Promise.all(
    users.map(async (user) => {
      const [assigned, open, won, wonThisMonth, slaBreached, activities] = await Promise.all([
        prisma.lead.count({ where: { orgId, assignedToId: user.id } }),
        prisma.lead.count({ where: { orgId, assignedToId: user.id, status: 'open' } }),
        prisma.lead.count({ where: { orgId, assignedToId: user.id, stage: 'Closed Won' } }),
        prisma.lead.count({
          where: {
            orgId,
            assignedToId: user.id,
            stage: 'Closed Won',
            stageChangedAt: { gte: monthStart },
          },
        }),
        prisma.lead.count({
          where: { orgId, assignedToId: user.id, slaBreached: true, status: 'open' },
        }),
        prisma.activity.count({ where: { orgId, createdBy: user.id } }),
      ])
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
      }
    })
  )

  return successResponse({ scope: isAdmin ? 'team' : 'own', stats })
})

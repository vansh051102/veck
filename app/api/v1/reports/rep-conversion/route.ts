import { prisma } from '@/lib/db'
import { paginatedResponse, withErrorHandler, getPaginationParams } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { PERMISSIONS } from '@/lib/rbac'
import { rbacService } from '@/lib/services/rbac.service'

const WON_STAGES = ['Order Confirmed', 'Order Closed']
const CLOSED_STAGES = [...WON_STAGES, 'Deal Lost', 'Disqualified']

// GET /api/v1/reports/rep-conversion - Per-salesperson conversion rate
// (won closed / total closed), org-wide. Mirrors kra-performance/sla-trends:
// org-scoped, paginated, admin-only analytics read.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ANALYTICS_READ)

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)

  const reps = await prisma.user.findMany({
    where: { orgId: ctx.orgId, status: 'active', assignedLeads: { some: {} } },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
    skip,
    take: limit,
  })
  const total = await prisma.user.count({
    where: { orgId: ctx.orgId, status: 'active', assignedLeads: { some: {} } },
  })

  const performance = await Promise.all(
    reps.map(async (rep) => {
      const [won, closed, totalAssigned] = await prisma.$transaction([
        prisma.lead.count({ where: { orgId: ctx.orgId, assignedToId: rep.id, stage: { in: WON_STAGES } } }),
        prisma.lead.count({ where: { orgId: ctx.orgId, assignedToId: rep.id, stage: { in: CLOSED_STAGES } } }),
        prisma.lead.count({ where: { orgId: ctx.orgId, assignedToId: rep.id } }),
      ])
      return {
        userId: rep.id,
        fullName: rep.fullName,
        wonCount: won,
        closedCount: closed,
        totalAssigned,
        conversionRate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : null,
      }
    })
  )

  return paginatedResponse(performance, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })
})

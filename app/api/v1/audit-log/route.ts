import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { paginatedResponse, withErrorHandler, getPaginationParams } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

// GET /api/v1/audit-log - Recent Activity feed for the Analytics page.
// Gated by analytics:read since it's presented as part of Analytics, not a
// standalone audit trail. Non-admin sees only their own actions (AuditLog
// has no lead-assignee concept to reuse buildOwnershipFilter against, so
// "own actions" is the right analog); admin sees the whole org and may
// filter to a specific user via ?userId=.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ANALYTICS_READ)
  const role = ctx.role

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams, 20)
  const filterUserId = url.searchParams.get('userId')

  const where =
    role === 'admin'
      ? { orgId, ...(filterUserId && { userId: filterUserId }) }
      : { orgId, userId }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceName: true,
        timestamp: true,
        // Without this the admin sees only that a STAGE_CHANGE happened, not
        // why: logAudit stores the reason and the outOfSequence /
        // flaggedDisqualify flags here.
        changes: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return paginatedResponse(entries, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })
})

import { prisma } from '@/lib/db'
import { requirePermission, PERMISSIONS } from '@/lib/rbac'
import {
  paginatedResponse,
  withErrorHandler,
  UnauthorizedError,
  extractOrgAndUserIds,
  extractUserRole,
  getPaginationParams,
} from '@/lib/api-response'

// GET /api/v1/audit-log - Recent Activity feed for the Analytics page.
// Gated by analytics:read since it's presented as part of Analytics, not a
// standalone audit trail. Non-admin sees only their own actions (AuditLog
// has no lead-assignee concept to reuse buildOwnershipFilter against, so
// "own actions" is the right analog); admin sees the whole org and may
// filter to a specific user via ?userId=.
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.ANALYTICS_READ)
  const role = extractUserRole(req.headers)

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

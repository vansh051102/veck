import { prisma } from '@/lib/db'
import { requirePermission, PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  extractOrgAndUserIds,
} from '@/lib/api-response'

// GET /api/v1/roles - List all roles in the organization
export const GET = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.ROLES_READ)

  const roles = await prisma.role.findMany({
    where: { orgId },
    orderBy: { hierarchyLevel: 'desc' },
  })

  return successResponse(roles)
})

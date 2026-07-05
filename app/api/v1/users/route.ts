import { getOrganizationUsers } from '@/lib/auth'
import { successResponse, withErrorHandler, UnauthorizedError, extractOrgAndUserIds } from '@/lib/api-response'

// GET /api/v1/users - List users in the caller's org (for assignment pickers etc.)
export const GET = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const users = await getOrganizationUsers(orgId)
  const activeUsers = users.filter((u) => u.status === 'active')

  return successResponse(activeUsers)
})

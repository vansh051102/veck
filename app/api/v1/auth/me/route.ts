import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { rbacService } from '@/lib/services/rbac.service'
import { isAuthDisabled } from '@/lib/dev-auth'
import { resolveDevBypassUser } from '@/lib/dev-bootstrap'

export const GET = withErrorHandler(async (req) => {
  if (!isAuthDisabled()) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header')
    }
  }

  let userId = req.headers.get('x-user-id')
  let orgId = req.headers.get('x-org-id')

  if ((!userId || !orgId) && isAuthDisabled()) {
    const bypass = await resolveDevBypassUser()
    if (bypass) {
      userId = bypass.id
      orgId = bypass.orgId
    }
  }

  if (!userId || !orgId) {
    throw new UnauthorizedError('User context not found')
  }

  const { prisma } = await import('@/lib/db')
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          subscriptionPlan: true,
          industry: true,
          domain: true,
          email: true,
          phone: true,
          gstin: true,
          pan: true,
          address: true,
          country: true,
          currency: true,
        },
      },
    },
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }

  if (user.status !== 'active') {
    throw new UnauthorizedError('User is not active')
  }

  const perms = await rbacService.getUserPermissions(userId)
  const permissions = perms.hasWildcard ? ['*'] : perms.permissions

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      department: user.department,
      designation: user.designation,
      status: user.status,
      lastLogin: user.lastLogin,
      avatarUrl: user.avatarUrl,
      defaultDashboard: user.defaultDashboard,
      permissions,
    },
    org: user.org,
  })
})

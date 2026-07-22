import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { rbacService } from '@/lib/services/rbac.service'
import { validateRequest } from '@/lib/middleware/validate-headers'

export const GET = withErrorHandler(async (req) => {
  // Resolve via the same header-first, Bearer-fallback chain every other
  // route uses. This route used to read x-user-id/x-org-id directly with no
  // fallback: whenever middleware.ts couldn't attach those headers (a
  // transient DB hiccup resolving the session, or a cache-cold request),
  // every page depending on AuthProvider -- i.e. the entire authenticated
  // app, since it wraps both app/(app)/layout.tsx and app/admin/layout.tsx --
  // broke, even though the caller's Bearer token was perfectly valid.
  const ctx = await validateRequest(req)

  const { prisma } = await import('@/lib/db')
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
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

  const perms = await rbacService.getUserPermissions(ctx.userId)
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

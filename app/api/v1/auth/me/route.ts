import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { getUserPermissions } from '@/lib/rbac'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { prisma } from '@/lib/db'

export const GET = withErrorHandler(async (req) => {
  // DB-verified identity (existence, active status, org match) — same boundary
  // every other route uses instead of trusting middleware headers directly.
  const ctx = await validateRequest(req)

  // Fetch user with organization for the client bootstrap payload
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          subscriptionPlan: true,
          moduleAccess: true,
        },
      },
    },
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }

  // Fetch permissions from the Role table
  const permissions = await getUserPermissions(ctx.userId)

  // Admin workspace entry: super-admins always; otherwise only users holding
  // an admin membership in a company OTHER than their home org (home-org
  // admins manage their own company via /settings).
  const foreignAdminCount = user.isSuperAdmin
    ? 0
    : await prisma.membership.count({
        where: {
          userId: ctx.userId,
          role: 'admin',
          status: 'active',
          NOT: { orgId: user.orgId },
        },
      })

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      designation: user.designation,
      status: user.status,
      lastLogin: user.lastLogin,
      avatarUrl: user.avatarUrl,
      defaultDashboard: user.defaultDashboard,
      isSuperAdmin: user.isSuperAdmin,
      canAccessAdminWorkspace: user.isSuperAdmin || foreignAdminCount > 0,
      permissions,
    },
    org: user.org,
  })
})

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
        },
      },
    },
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }

  // Fetch permissions from the Role table
  const permissions = await getUserPermissions(ctx.userId)

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
      permissions,
    },
    org: user.org,
  })
})

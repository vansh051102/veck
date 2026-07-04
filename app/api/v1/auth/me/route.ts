import { getSessionUser } from '@/lib/auth'
import { successResponse, errorResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export const GET = withErrorHandler(async (req) => {
  // Get session from request
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header')
  }

  const token = authHeader.substring(7)

  // Get user from database using headers set by middleware
  const userId = req.headers.get('x-user-id')
  const orgId = req.headers.get('x-org-id')

  if (!userId || !orgId) {
    throw new UnauthorizedError('User context not found')
  }

  // Fetch user with organization
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
        },
      },
    },
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin,
      avatarUrl: user.avatarUrl,
    },
    org: user.org,
  })
})

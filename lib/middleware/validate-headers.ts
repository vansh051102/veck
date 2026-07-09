// ============================================================================
// REQUEST VALIDATION MIDDLEWARE
// ============================================================================
// Re-verifies the user identity from the database instead of blindly trusting
// headers set by middleware.ts. This is the critical security boundary:
//
//   middleware.ts (Edge Runtime)
//     → calls /api/internal/session (Node Runtime, Prisma)
//     → sets x-user-id, x-org-id, x-user-role headers
//
//   API routes (Node Runtime)
//     → validateRequest(req) re-fetches user from DB
//     → trusts the userId (derived from JWT → Supabase → DB lookup)
//     → does NOT trust role/department/status (could be stale)
//
// Usage in API routes:
//   export const GET = withErrorHandler(async (req) => {
//     const ctx = await validateRequest(req)
//     // ctx.userId, ctx.orgId, ctx.user, ctx.role are DB-verified
//   })

import { prisma } from '@/lib/db'
import { UnauthorizedError } from '@/lib/api-response'

export interface RequestContext {
  userId: string
  orgId: string
  role: string
  department: string | null
  designation: string | null
  user: {
    id: string
    email: string
    fullName: string
    role: string
    status: string
    department: string | null
    designation: string | null
  }
}

/**
 * Validate the current request by re-verifying the user from the database.
 *
 * The userId comes from the middleware's session resolution (JWT → Supabase → DB).
 * This function re-fetches the user to ensure:
 *   1. The user still exists
 *   2. The user is still active
 *   3. We have fresh role/department data (not stale headers)
 *
 * Throws UnauthorizedError if the user is invalid.
 */
export async function validateRequest(req: Request): Promise<RequestContext> {
  return verifyUserContext(
    req.headers.get('x-user-id'),
    req.headers.get('x-org-id')
  )
}

/**
 * DB-verify a user context from the middleware-injected identity. Shared by
 * validateRequest (API routes, reads req.headers) and getActionContext (Server
 * Actions, reads next/headers). This is the security boundary — the userId is
 * trusted (JWT → Supabase → DB), role/status are re-fetched fresh.
 */
export async function verifyUserContext(
  userId: string | null,
  orgId: string | null
): Promise<RequestContext> {
  if (!userId || !orgId) {
    throw new UnauthorizedError('Missing user context — request must go through middleware')
  }

  // Re-verify from DB — catches deleted users, deactivated accounts, role changes
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      orgId: true,
      department: true,
      designation: true,
    },
  })

  if (!user) {
    throw new UnauthorizedError('User not found — account may have been deleted')
  }

  if (user.status !== 'active') {
    throw new UnauthorizedError(`Account is ${user.status} — contact your administrator`)
  }

  if (user.orgId !== orgId) {
    throw new UnauthorizedError('Organization mismatch — possible session hijacking')
  }

  return {
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    department: user.department,
    designation: user.designation,
    user,
  }
}

/**
 * Validate request and require a specific role.
 * Use for admin-only or role-gated endpoints.
 */
export async function validateRequestWithRole(
  req: Request,
  allowedRoles: string[]
): Promise<RequestContext> {
  const ctx = await validateRequest(req)
  if (!allowedRoles.includes(ctx.role)) {
    throw new UnauthorizedError(`This endpoint requires one of: ${allowedRoles.join(', ')}`)
  }
  return ctx
}

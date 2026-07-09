// ============================================================================
// WORKSPACE ADMIN AUTHORIZATION
// ============================================================================
// Authorization boundary for the multi-company admin workspace (/admin).
// Unlike the rest of the app (scoped to ctx.orgId = the caller's HOME org),
// admin workspace routes are parameterized by a TARGET org and require:
//   - platform super-admin (User.isSuperAdmin), OR
//   - an active admin Membership in the target org.

import { prisma } from '@/lib/db'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import {
  validateRequest,
  type RequestContext,
} from '@/lib/middleware/validate-headers'

export interface WorkspaceAdminContext extends RequestContext {
  isSuperAdmin: boolean
  targetOrgId: string
}

/**
 * Validate the request (same DB-verified identity boundary as validateRequest)
 * and require workspace-admin rights over the target org.
 *
 * Throws NotFoundError if the org doesn't exist, ForbiddenError if the caller
 * is neither a super-admin nor an active admin member of it.
 */
export async function requireWorkspaceAdmin(
  req: Request,
  targetOrgId: string
): Promise<WorkspaceAdminContext> {
  const ctx = await validateRequest(req)

  const org = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { id: true },
  })
  if (!org) {
    throw new NotFoundError('Company not found')
  }

  if (!ctx.user.isSuperAdmin) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: ctx.userId, orgId: targetOrgId } },
      select: { role: true, status: true },
    })
    if (!membership || membership.role !== 'admin' || membership.status !== 'active') {
      throw new ForbiddenError('You are not a workspace admin of this company')
    }
  }

  return { ...ctx, isSuperAdmin: ctx.user.isSuperAdmin, targetOrgId }
}

/**
 * Validate the request and require platform super-admin (e.g. creating
 * companies). No target org involved.
 */
export async function requireSuperAdmin(req: Request): Promise<RequestContext> {
  const ctx = await validateRequest(req)
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('This action requires a platform super-admin')
  }
  return ctx
}

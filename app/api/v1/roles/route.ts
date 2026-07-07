import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

// GET /api/v1/roles - List all roles in the organization
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.ROLES_READ)

  const roles = await prisma.role.findMany({
    where: { orgId },
    orderBy: { hierarchyLevel: 'desc' },
  })

  return successResponse(roles)
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { PERMISSIONS, buildOwnershipFilter } from '@/lib/rbac'
import { LEAD_PRIORITIES } from '@/lib/validation'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { z } from 'zod'

const BulkUpdateSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    assignedToId: z.string().uuid().nullable().optional(),
    priority: z.enum(LEAD_PRIORITIES).optional(),
  })
  .refine((d) => d.assignedToId !== undefined || d.priority !== undefined, {
    message: 'Provide assignedToId or priority to update',
  })

// PUT /api/v1/leads/bulk - Apply one change (reassign or set priority) to many
// leads in a single updateMany, instead of N per-lead HTTP requests. Ownership-
// scoped: a rep can only touch leads their ownership filter allows.
export const PUT = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  const perms = await rbacService.getUserPermissions(ctx.userId)
  rbacService.requirePermission(perms, PERMISSIONS.LEADS_EDIT)

  const body = await req.json()
  const parsed = BulkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid bulk update request', parsed.error.flatten())
  }
  const { ids, assignedToId, priority } = parsed.data

  if (assignedToId !== undefined) {
    rbacService.requirePermission(perms, PERMISSIONS.LEADS_ASSIGN)
  }

  // Validate assignee is an active user in this org
  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, orgId, status: 'active' },
      select: { id: true },
    })
    if (!assignee) throw new ValidationError('Assignee not found or inactive')
  }

  const ownershipFilter = buildOwnershipFilter(ctx.userId, ctx.role, ctx.department, 'leads')
  const now = new Date()

  const result = await prisma.lead.updateMany({
    where: { id: { in: ids }, orgId, ...ownershipFilter },
    data: {
      ...(priority !== undefined && { priority }),
      ...(assignedToId !== undefined && { assignedToId, assignedAt: assignedToId ? now : null }),
    },
  })

  await logAudit(orgId, ctx.userId, 'BULK_UPDATE', 'Lead', 'bulk', `${result.count} lead(s)`, {
    requestedIds: ids.length,
    updated: result.count,
    ...(priority !== undefined && { priority }),
    ...(assignedToId !== undefined && { assignedToId }),
  })

  return successResponse({ updated: result.count })
})

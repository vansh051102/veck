import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, NotFoundError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// GET /api/v1/leads/:id/timeline?limit=6 - Recent timeline events for the lead.
// Lightweight (no viewCount side-effect) — powers the leads-list hover popover.
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_READ
  )
  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) throw new NotFoundError('Lead')

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 6, 1), 25)

  const timeline = await prisma.timeline.findUnique({
    where: { leadId: params.id },
    include: { events: { orderBy: { createdAt: 'desc' }, take: limit } },
  })

  return successResponse(timeline?.events ?? [])
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UpdateLeadSchema } from '@/lib/validation'
import { isTerminalStage } from '@/lib/lead-stages'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

// GET /api/v1/leads/:id - Get a single lead with full detail
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_READ
  )

  if (!await canAccessLead(ctx.userId, ctx.role, params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: {
      contact: true,
      assignedTo: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      checklists: { include: { items: true } },
      activities: { orderBy: { createdAt: 'desc' } },
      timeline: { include: { events: { orderBy: { createdAt: 'desc' } } } },
      quotes: true,
      purchaseRequests: true,
    },
  })

  if (!lead) throw new NotFoundError('Lead')

  // Increment view count / lastViewedAt (fire-and-forget, doesn't block response)
  prisma.lead
    .update({
      where: { id: lead.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch((err) => console.error('Failed to update lead view count:', err))

  return successResponse(lead)
})

// PUT /api/v1/leads/:id - Update lead fields (not stage/assignment - use dedicated endpoints)
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_EDIT
  )

  if (!await canAccessLead(ctx.userId, ctx.role, params.id)) {
    throw new NotFoundError('Lead')
  }

  const existing = await prisma.lead.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!existing) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = UpdateLeadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid lead data', parsed.error.flatten())
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data: parsed.data,
  })

  await logAudit(ctx.orgId, ctx.userId, 'UPDATE', 'Lead', lead.id, lead.companyName, parsed.data)

  return successResponse(lead)
})

// DELETE /api/v1/leads/:id - Soft delete (mark disqualified + closed status)
// Consistent with the workflow engine: leads already in a terminal stage
// (Closed Won / Deal Lost / Disqualified) cannot be deleted, matching the
// stage-change endpoint's terminal-stage protection.
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_DELETE
  )

  const existing = await prisma.lead.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!existing) throw new NotFoundError('Lead')

  if (isTerminalStage(existing.stage)) {
    throw new ConflictError(
      `Cannot delete a lead in terminal stage "${existing.stage}". Terminal leads are immutable.`
    )
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data: {
      status: 'disqualified',
      stage: 'Disqualified',
      dealLostReason: 'Deleted by user',
      dealLostDate: new Date(),
    },
  })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'Lead', lead.id, lead.companyName)

  return successResponse({ id: lead.id, deleted: true })
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { CreateChecklistSchema } from '@/lib/validation'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

// POST /api/v1/leads/:id/checklists - Add a checklist to a lead
// (Note: the NEW_LEAD checklist is auto-created on lead creation; this
// endpoint is for adding stage-specific checklists, e.g. CONTACTED / QUALIFIED.)
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CHECKLISTS_CREATE)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const body = await req.json()
  const parsed = CreateChecklistSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid checklist data', parsed.error.flatten())
  }
  const input = parsed.data

  const checklist = await prisma.checklist.create({
    data: {
      leadId: lead.id,
      title: input.title,
      description: input.description,
      isRequired: input.isRequired,
      items: { create: input.items.map((item) => ({ title: item.title })) },
    },
    include: { items: true },
  })

  await logAudit(orgId, userId, 'CREATE', 'Checklist', checklist.id, checklist.title)

  return successResponse(checklist, { statusCode: 201 })
})

// GET /api/v1/leads/:id/checklists - Get checklists for a lead, with completion %
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CHECKLISTS_READ)

  const role = ctx.role
  if (!await canAccessLead(userId, role || 'admin', params.id)) {
    throw new NotFoundError('Lead')
  }

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) throw new NotFoundError('Lead')

  const checklists = await prisma.checklist.findMany({
    where: { leadId: lead.id },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })

  const withCompletion = checklists.map((checklist) => {
    const total = checklist.items.length
    const done = checklist.items.filter((i) => i.completed).length
    return {
      ...checklist,
      completionPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    }
  })

  return successResponse(withCompletion)
})

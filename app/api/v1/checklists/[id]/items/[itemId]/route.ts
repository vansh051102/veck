import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { ChecklistItemSchema } from '@/lib/validation'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS, canAccessLead } from '@/lib/rbac'

interface Params {
  params: { id: string; itemId: string }
}

// PUT /api/v1/checklists/:id/items/:itemId - Toggle item completion.
// When every item on the checklist is complete, the checklist itself is
// marked completed (and vice versa if an item is unchecked afterward).
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.CHECKLISTS_EDIT
  )

  const item = await prisma.checklistItem.findFirst({
    where: { id: params.itemId, checklistId: params.id },
    include: { checklist: { include: { lead: true, items: true } } },
  })
  if (!item || item.checklist.lead.orgId !== orgId) {
    throw new NotFoundError('Checklist item')
  }

  if (!await canAccessLead(ctx.userId, ctx.role, item.checklist.lead.id)) {
    throw new NotFoundError('Checklist item')
  }

  const body = await req.json()
  const parsed = ChecklistItemSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid checklist item update', parsed.error.flatten())
  }
  const { completed } = parsed.data
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.checklistItem.update({
      where: { id: item.id },
      data: {
        completed,
        completedAt: completed ? now : null,
        completedBy: completed ? userId : null,
      },
    })

    // Recalculate whether the parent checklist should flip completed/incomplete
    const siblingItems = item.checklist.items.map((i) =>
      i.id === item.id ? updatedItem : i
    )
    const allComplete = siblingItems.length > 0 && siblingItems.every((i) => i.completed)

    const updatedChecklist = await tx.checklist.update({
      where: { id: item.checklistId },
      data: allComplete
        ? { completedAt: now, completedBy: userId }
        : { completedAt: null, completedBy: null },
      include: { items: true },
    })

    return { updatedItem, updatedChecklist }
  })

  await logAudit(
    orgId,
    userId,
    'UPDATE',
    'ChecklistItem',
    item.id,
    item.title,
    { completed }
  )

  const total = result.updatedChecklist.items.length
  const done = result.updatedChecklist.items.filter((i) => i.completed).length

  return successResponse({
    item: result.updatedItem,
    checklist: {
      ...result.updatedChecklist,
      completionPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    },
  })
})

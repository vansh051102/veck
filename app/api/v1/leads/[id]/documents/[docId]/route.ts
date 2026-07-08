import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase-clients'
import { successResponse, withErrorHandler, NotFoundError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string; docId: string }
}

const BUCKET = 'lead-documents'

// DELETE /api/v1/leads/:id/documents/:docId - Remove a document (row + object)
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_EDIT
  )
  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) throw new NotFoundError('Lead')

  const doc = await prisma.leadDocument.findFirst({
    where: { id: params.docId, leadId: params.id, orgId: ctx.orgId },
  })
  if (!doc) throw new NotFoundError('Document')

  // Remove the stored object first; the row is the source of truth for the UI,
  // so drop it even if the storage delete reports an error (best-effort).
  await supabaseAdmin.storage.from(BUCKET).remove([doc.storagePath])
  await prisma.leadDocument.delete({ where: { id: doc.id } })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'LeadDocument', doc.id, doc.name)

  return successResponse({ id: doc.id, deleted: true })
})

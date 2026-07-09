import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase-clients'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'

interface Params {
  params: { id: string }
}

const BUCKET = 'lead-documents'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const SIGNED_URL_TTL = 60 * 60 // 1 hour

// Creates the private bucket on first use so deploys don't need a manual step.
async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
  }
}

// GET /api/v1/leads/:id/documents - List a lead's documents with signed download URLs
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_READ
  )
  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) throw new NotFoundError('Lead')

  const docs = await prisma.leadDocument.findMany({
    where: { leadId: params.id, orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
  })

  const withUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(doc.storagePath, SIGNED_URL_TTL)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  return successResponse(withUrls)
})

// POST /api/v1/leads/:id/documents - Upload a document (multipart/form-data, field "file")
export const POST = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_EDIT
  )
  if (!(await canAccessLead(ctx.userId, ctx.role, params.id))) throw new NotFoundError('Lead')

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, companyName: true },
  })
  if (!lead) throw new NotFoundError('Lead')

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new ValidationError('A file is required (multipart field "file")')
  }
  if (file.size === 0) throw new ValidationError('File is empty')
  if (file.size > MAX_BYTES) throw new ValidationError('File exceeds the 25 MB limit')

  await ensureBucket()

  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const storagePath = `${ctx.orgId}/${lead.id}/${randomUUID()}-${safeName}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) {
    throw new ValidationError(`Upload failed: ${uploadError.message}`)
  }

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.leadDocument.create({
      data: {
        orgId: ctx.orgId,
        leadId: lead.id,
        name: file.name,
        storagePath,
        mimeType: file.type || null,
        sizeBytes: file.size,
        uploadedBy: ctx.userId,
      },
    })

    const timeline = await tx.timeline.upsert({
      where: { leadId: lead.id },
      create: { orgId: ctx.orgId, leadId: lead.id },
      update: {},
    })
    await tx.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        type: 'document_added',
        title: `Document uploaded: ${file.name}`,
        createdBy: ctx.userId,
      },
    })

    return created
  })

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'LeadDocument', doc.id, doc.name)

  return successResponse(doc, { statusCode: 201 })
})

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { UpdateContactSchema } from '@/lib/validation'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, NotFoundError, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

// GET /api/v1/contacts/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CONTACTS_READ)

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, orgId },
    include: { leads: { select: { id: true, companyName: true, stage: true, createdAt: true } } },
  })
  if (!contact) throw new NotFoundError('Contact')

  return successResponse(contact)
})

// PUT /api/v1/contacts/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CONTACTS_EDIT)

  const existing = await prisma.contact.findFirst({ where: { id: params.id, orgId } })
  if (!existing) throw new NotFoundError('Contact')

  const body = await req.json()
  const parsed = UpdateContactSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid contact data', parsed.error.flatten())
  }

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: parsed.data,
  })

  await logAudit(orgId, userId, 'UPDATE', 'Contact', contact.id, `${contact.firstName} ${contact.lastName}`, parsed.data)

  return successResponse(contact)
})

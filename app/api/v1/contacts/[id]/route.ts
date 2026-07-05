import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { UpdateContactSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
} from '@/lib/api-response'

interface Params {
  params: { id: string }
}

// GET /api/v1/contacts/:id
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, orgId },
    include: { leads: { select: { id: true, companyName: true, stage: true, createdAt: true } } },
  })
  if (!contact) throw new NotFoundError('Contact')

  return successResponse(contact)
})

// PUT /api/v1/contacts/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

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

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { CreateContactSchema } from '@/lib/validation'
import { PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  paginatedResponse,
  withErrorHandler,
  ValidationError,
  getPaginationParams,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

// POST /api/v1/contacts - Create a contact
export const POST = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CONTACTS_CREATE)

  const body = await req.json()
  const parsed = CreateContactSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid contact data', parsed.error.flatten())
  }
  const input = parsed.data

  const contact = await prisma.contact.create({
    data: {
      orgId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      designation: input.designation,
      source: input.source,
      sourceDetails: input.sourceDetails,
      tags: input.tags,
      createdById: userId,
    },
  })

  await logAudit(orgId, userId, 'CREATE', 'Contact', contact.id, `${contact.firstName} ${contact.lastName}`)

  return successResponse(contact, { statusCode: 201 })
})

// GET /api/v1/contacts - List contacts with pagination & search
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.CONTACTS_READ)

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)
  const search = url.searchParams.get('search')
  // Exact-match params for duplicate detection (used by the new-lead form)
  const phoneExact = url.searchParams.get('phone')
  const emailExact = url.searchParams.get('email')

  const where = {
    orgId,
    ...(phoneExact || emailExact
      ? {
          OR: [
            ...(phoneExact ? [{ phone: phoneExact }] : []),
            ...(emailExact ? [{ email: emailExact }] : []),
          ],
        }
      : search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contact.count({ where }),
  ])

  return paginatedResponse(contacts, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })
})

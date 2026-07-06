import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { CreateContactSchema } from '@/lib/validation'
import { requirePermission, PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  paginatedResponse,
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  extractOrgAndUserIds,
  getPaginationParams,
} from '@/lib/api-response'

// POST /api/v1/contacts - Create a contact
export const POST = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.CONTACTS_CREATE)

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
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.CONTACTS_READ)

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)
  const search = url.searchParams.get('search')

  const where = {
    orgId,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
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

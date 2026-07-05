import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { CreateLeadSchema, LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/validation'
import {
  successResponse,
  paginatedResponse,
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  extractOrgAndUserIds,
  getPaginationParams,
} from '@/lib/api-response'

// POST /api/v1/leads - Create a lead (Step 1 of the workflow)
export const POST = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const body = await req.json()
  const parsed = CreateLeadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid lead data', parsed.error.flatten())
  }
  const input = parsed.data

  // Contact must belong to the same org
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, orgId },
  })
  if (!contact) throw new NotFoundError('Contact')

  const lead = await createLeadWithDefaults({
    orgId,
    contactId: input.contactId,
    companyName: input.companyName,
    priority: input.priority,
    notes: input.notes,
    source: input.source,
    sourceDetails: input.sourceDetails,
    tags: input.tags,
    createdById: userId,
  })

  await logAudit(orgId, userId, 'CREATE', 'Lead', lead.id, lead.companyName)

  return successResponse(lead, { statusCode: 201 })
})

// GET /api/v1/leads - List leads with pagination & filters
export const GET = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)

  const stage = url.searchParams.get('stage')
  const priority = url.searchParams.get('priority')
  const assignedToId = url.searchParams.get('assignedToId')
  const search = url.searchParams.get('search')
  const days = url.searchParams.get('days') // quick time-range filter: 7 / 30 / 90
  const from = url.searchParams.get('from') // custom range (ISO date)
  const to = url.searchParams.get('to')
  const sortBy = url.searchParams.get('sortBy') || 'createdAt'
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : ('desc' as const)

  const SORTABLE = ['createdAt', 'companyName', 'priority', 'stage', 'lastActivityAt', 'slaDeadline']
  if (!SORTABLE.includes(sortBy)) {
    throw new ValidationError(`Invalid sortBy: ${sortBy}. Allowed: ${SORTABLE.join(', ')}`)
  }
  if ((from && isNaN(Date.parse(from))) || (to && isNaN(Date.parse(to)))) {
    throw new ValidationError('Invalid from/to date')
  }

  if (stage && !(LEAD_STAGES as readonly string[]).includes(stage)) {
    throw new ValidationError(`Invalid stage filter: ${stage}`)
  }
  if (priority && !(LEAD_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ValidationError(`Invalid priority filter: ${priority}`)
  }
  if (days && (!/^\d+$/.test(days) || Number(days) <= 0 || Number(days) > 365)) {
    throw new ValidationError(`Invalid days filter: ${days}`)
  }

  const where = {
    orgId,
    ...(stage && { stage }),
    ...(priority && { priority }),
    ...(assignedToId && { assignedToId }),
    ...((days || from || to) && {
      createdAt: {
        ...(days && { gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) }),
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) }),
      },
    }),
    ...(search && {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' as const } },
        { notes: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortDir },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.lead.count({ where }),
  ])

  return paginatedResponse(leads, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })
})

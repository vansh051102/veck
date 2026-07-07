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
  ConflictError,
  extractOrgAndUserIds,
  extractUserRole,
  extractUserDepartment,
  getPaginationParams,
} from '@/lib/api-response'
import { requirePermission, buildOwnershipFilter, PERMISSIONS } from '@/lib/rbac'

// POST /api/v1/leads - Create a lead (Step 1 of the workflow)
export const POST = withErrorHandler(async (req) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.LEADS_CREATE)

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

  // Block duplicate leads: if this contact already has an open (non-terminal)
  // lead, surface the existing one instead of creating a second.
  const existingLead = await prisma.lead.findFirst({
    where: {
      orgId,
      contactId: input.contactId,
      stage: { notIn: ['Closed Won', 'Deal Lost', 'Disqualified'] },
    },
    select: { id: true, companyName: true, stage: true },
  })
  if (existingLead) {
    throw new ConflictError(
      `An open lead for this contact already exists (${existingLead.companyName} — ${existingLead.stage}). Lead ID: ${existingLead.id}`
    )
  }

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
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.LEADS_READ)

  const role = extractUserRole(req.headers)
  const department = extractUserDepartment(req.headers)

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)

  const stage = url.searchParams.get('stage')
  const priority = url.searchParams.get('priority')
  const assignedToId = url.searchParams.get('assignedToId')
  const contactOutcome = url.searchParams.get('contactOutcome') // connected | not_received
  const slaBreached = url.searchParams.get('slaBreached')
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
  if (contactOutcome && !['connected', 'not_received'].includes(contactOutcome)) {
    throw new ValidationError(`Invalid contactOutcome filter: ${contactOutcome}`)
  }

  const ownershipFilter = buildOwnershipFilter(userId, role || 'admin', department, 'leads')

  const where = {
    orgId,
    ...ownershipFilter,
    ...(stage && { stage }),
    ...(priority && { priority }),
    ...(assignedToId && { assignedToId }),
    // "not_received" also covers leads with no call logged yet (null outcome)
    ...(contactOutcome === 'connected' && { contactOutcome: 'connected' }),
    ...(contactOutcome === 'not_received' && { NOT: { contactOutcome: 'connected' } }),
    ...(slaBreached === 'true' && { slaBreached: true }),
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
        // Lead origin: who sourced/created it (marketing attribution)
        createdBy: { select: { id: true, fullName: true } },
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

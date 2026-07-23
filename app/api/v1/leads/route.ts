import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { CreateLeadSchema, LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/validation'
import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  successResponse,
  paginatedResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
  ConflictError,
  InternalServerError,
  getPaginationParams,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { buildOwnershipFilterAsync, PERMISSIONS } from '@/lib/rbac'

// POST /api/v1/leads - Create a lead (Step 1 of the workflow)
export const POST = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_CREATE
  )

  const body = await req.json()
  const parsed = CreateLeadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid lead data', parsed.error.flatten())
  }
  const input = parsed.data

  // Contact must belong to the same org
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, orgId: ctx.orgId },
  })
  if (!contact) throw new NotFoundError('Contact')

  // createLeadWithDefaults's transaction body calls pickAssignee/startSlaClock/
  // createSopChecklistsForStage — a bug or missing-config edge case in any of
  // those throws a plain, unnamed Error that would otherwise fall through
  // errorResponse()'s catch-all as an opaque "Unexpected error occurred" even
  // though nothing about the user's input was invalid. Surface it as a
  // scoped, retry-able message instead, while still logging the real cause.
  let result
  try {
    result = await createLeadWithDefaults({
      orgId: ctx.orgId,
      contactId: input.contactId,
      companyName: input.companyName,
      priority: input.priority,
      notes: input.notes,
      source: input.source,
      sourceDetails: input.sourceDetails,
      tags: input.tags,
      createdById: ctx.userId,
      creatorRole: ctx.role,
    })
  } catch (err) {
    if (err instanceof AppError || err instanceof Prisma.PrismaClientKnownRequestError) throw err
    logger.error({ err }, 'createLeadWithDefaults failed unexpectedly')
    throw new InternalServerError('Could not create lead — please retry')
  }

  if (result.duplicate) {
    throw new ConflictError(
      `This lead is already assigned to ${result.existingLead.assignedTo?.fullName ?? 'someone'} ` +
      `(${result.existingLead.stage}). Lead ID: ${result.existingLead.id}`
    )
  }

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'Lead', result.lead.id, result.lead.companyName)

  return successResponse(result.lead, { statusCode: 201 })
})

// GET /api/v1/leads - List leads with pagination & filters
// Admin may pass ?viewAsUserId=<id> to see leads scoped to another user's role.
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.LEADS_READ
  )

  const url = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(url.searchParams)

  // Resolve effective user context for viewAs impersonation (admin only)
  const viewAsUserId = url.searchParams.get('viewAsUserId')
  let effectiveUserId = ctx.userId
  let effectiveRole = ctx.role
  let effectiveDepartment: string | null = ctx.department

  if (viewAsUserId && ctx.role === 'admin') {
    const viewAsUser = await prisma.user.findFirst({
      where: { id: viewAsUserId, orgId: ctx.orgId },
      select: { id: true, role: true, department: true },
    })
    if (viewAsUser) {
      effectiveUserId = viewAsUser.id
      effectiveRole = viewAsUser.role
      effectiveDepartment = viewAsUser.department
    }
  }

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

  const ownershipFilter = await buildOwnershipFilterAsync(
    effectiveUserId,
    effectiveRole,
    effectiveDepartment,
    'leads'
  )

  const where = {
    orgId: ctx.orgId,
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
        createdBy: { select: { id: true, fullName: true } },
        quotes: {
          select: { id: true, quoteNumber: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        activities: {
          select: { type: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.lead.count({ where }),
  ])

  const enriched = leads.map((lead) => {
    const latest = lead.activities[0]
    const latestQuote = lead.quotes[0] ?? null
    const activityLabel = latest?.title || latest?.type || 'Updated'
    let stageDetails = 'No stage details'
    if (lead.dealLostReason) {
      stageDetails = lead.dealLostDetails
        ? `${lead.dealLostReason}: ${lead.dealLostDetails}`
        : lead.dealLostReason
    } else if (lead.quotationNumber) {
      stageDetails = `Quote ${lead.quotationNumber}`
    } else if (latestQuote) {
      stageDetails = `Quote ${latestQuote.quoteNumber}`
    } else if (lead.requirement) {
      stageDetails = lead.requirement.slice(0, 80)
    }

    const { activities, quotes, ...rest } = lead
    return {
      ...rest,
      latestQuote,
      hasQuote: Boolean(latestQuote || lead.quotationNumber),
      lastActivityLabel: activityLabel,
      stageDetails,
    }
  })

  return paginatedResponse(enriched, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })
})

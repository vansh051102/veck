import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toCsv } from '@/lib/csv'
import { LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/validation'
import {
  withErrorHandler,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  extractOrgAndUserIds,
  extractUserRole,
} from '@/lib/api-response'

const EXPORT_LIMIT = 5000

// GET /api/v1/leads/export - Download leads as CSV. Accepts the same
// filters as GET /leads (stage, priority, days, search).
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId } = ids

  const role = extractUserRole(req.headers)
  if (role !== 'admin') throw new ForbiddenError('Only admins can export leads')

  const url = new URL(req.url)
  const stage = url.searchParams.get('stage')
  const priority = url.searchParams.get('priority')
  const days = url.searchParams.get('days')
  const search = url.searchParams.get('search')

  if (stage && !(LEAD_STAGES as readonly string[]).includes(stage)) {
    throw new ValidationError(`Invalid stage filter: ${stage}`)
  }
  if (priority && !(LEAD_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ValidationError(`Invalid priority filter: ${priority}`)
  }

  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      ...(stage && { stage }),
      ...(priority && { priority }),
      ...(days && /^\d+$/.test(days)
        ? { createdAt: { gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } }
        : {}),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' as const } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    },
    take: EXPORT_LIMIT,
    orderBy: { createdAt: 'desc' },
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
      assignedTo: { select: { fullName: true } },
    },
  })

  const csv = toCsv(
    [
      'Company',
      'Contact First Name',
      'Contact Last Name',
      'Email',
      'Phone',
      'Stage',
      'Priority',
      'Assigned To',
      'SLA Breached',
      'Source',
      'Created At',
      'Last Activity At',
      'Notes',
    ],
    leads.map((l) => [
      l.companyName,
      l.contact?.firstName,
      l.contact?.lastName,
      l.contact?.email,
      l.contact?.phone,
      l.stage,
      l.priority,
      l.assignedTo?.fullName,
      l.slaBreached ? 'yes' : 'no',
      l.source,
      l.createdAt.toISOString(),
      l.lastActivityAt.toISOString(),
      l.notes,
    ])
  )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})

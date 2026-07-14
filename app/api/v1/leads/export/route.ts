import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toCsv } from '@/lib/csv'
import { logAudit } from '@/lib/audit'
import { LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/validation'
import { PERMISSIONS } from '@/lib/rbac'
import { withErrorHandler, ValidationError, ForbiddenError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { buildOwnershipFilter } from '@/lib/ownership'
import { rbacService } from '@/lib/services/rbac.service'

const HARD_EXPORT_LIMIT = 5000

/** Mask all but the last 4 characters. Empty/short values pass through untouched. */
function maskValue(value: string | null | undefined): string {
  if (!value || value.length <= 4) return value ?? ''
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`
}

// GET /api/v1/leads/export - Download leads as CSV. Accepts the same
// filters as GET /leads (stage, priority, days, search), plus multi-source
// and day-of-week filtering. Enforces the requesting role's daily export
// quota and PII masking policy (Role.maxExportLimitDaily / maskPiiData).
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.LEADS_EXPORT)

  const url = new URL(req.url)
  const stage = url.searchParams.get('stage')
  const priority = url.searchParams.get('priority')
  const days = url.searchParams.get('days')
  const search = url.searchParams.get('search')
  const sources = url.searchParams.getAll('source').filter(Boolean)
  const weekdays = url.searchParams
    .getAll('weekday')
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) // 1=Monday..7=Sunday

  if (stage && !(LEAD_STAGES as readonly string[]).includes(stage)) {
    throw new ValidationError(`Invalid stage filter: ${stage}`)
  }
  if (priority && !(LEAD_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ValidationError(`Invalid priority filter: ${priority}`)
  }

  // Resolve the requester's role policy. Admins bypass masking and quota.
  const isAdmin = ctx.role === 'admin'
  const roleRow = isAdmin
    ? null
    : await prisma.role.findFirst({
        where: { orgId, name: ctx.role },
        select: { maxExportLimitDaily: true, maskPiiData: true },
      })
  const maskPii = roleRow?.maskPiiData ?? true
  const dailyLimit = isAdmin ? HARD_EXPORT_LIMIT : (roleRow?.maxExportLimitDaily ?? 100)

  if (!isAdmin) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todaysExports = await prisma.auditLog.findMany({
      where: { orgId, userId: ctx.userId, action: 'EXPORT', resourceType: 'Lead', timestamp: { gte: startOfDay } },
      select: { changes: true },
    })
    const exportedToday = todaysExports.reduce(
      (sum, e) => sum + (typeof (e.changes as any)?.count === 'number' ? (e.changes as any).count : 0),
      0
    )
    if (exportedToday >= dailyLimit) {
      throw new ForbiddenError(`Daily export limit of ${dailyLimit} rows reached`)
    }
  }

  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      ...buildOwnershipFilter(ctx.userId, ctx.role, ctx.department, 'leads'),
      ...(stage && { stage }),
      ...(priority && { priority }),
      ...(sources.length && { source: { in: sources } }),
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
    take: Math.min(dailyLimit, HARD_EXPORT_LIMIT),
    orderBy: { createdAt: 'desc' },
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true, designation: true, gstNumber: true } },
      assignedTo: { select: { fullName: true } },
    },
  })

  // Day-of-week filter applied post-query (Postgres EXTRACT(ISODOW) would be
  // cheaper for large datasets, but the export path is already capped and
  // ownership/source filters run in SQL — this keeps the query portable).
  const filteredLeads = weekdays.length
    ? leads.filter((l) => weekdays.includes(l.createdAt.getDay() === 0 ? 7 : l.createdAt.getDay()))
    : leads

  const csv = toCsv(
    [
      'Company',
      'Contact First Name',
      'Contact Last Name',
      'Email',
      'Phone',
      'Designation',
      'GST No',
      'Stage',
      'Priority',
      'Assigned To',
      'SLA Breached',
      'Source',
      'Created At',
      'Last Activity At',
      'Notes',
    ],
    filteredLeads.map((l) => [
      l.companyName,
      l.contact?.firstName,
      l.contact?.lastName,
      maskPii ? maskValue(l.contact?.email) : l.contact?.email,
      maskPii ? maskValue(l.contact?.phone) : l.contact?.phone,
      l.contact?.designation,
      maskPii ? maskValue(l.contact?.gstNumber) : l.contact?.gstNumber,
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

  await logAudit(orgId, ctx.userId, 'EXPORT', 'Lead', 'bulk', 'CSV export', { count: filteredLeads.length })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})

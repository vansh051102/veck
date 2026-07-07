import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { LEAD_PRIORITIES } from '@/lib/validation'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

const ImportRowSchema = z.object({
  companyName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  gstNumber: z.string().optional(),
  city: z.string().optional(),
  tag: z.string().optional(),
  assignedToEmail: z.string().email().optional(),
})

const ImportSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
})

// POST /api/v1/leads/import - Bulk import leads (CSV parsed client-side).
// Contacts are upserted by email; each row creates a lead with full SOP
// defaults (checklists, timeline, auto-assignment) via the shared creator.
// Rows are processed independently: failures are reported per-row and do
// not roll back successful ones.
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.LEADS_IMPORT)

  const body = await req.json()
  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid import data', parsed.error.flatten())
  }

  // Resolve "assign to" emails to user IDs up front (one query instead of
  // one per row). Unmatched emails just leave the lead unassigned.
  const assigneeEmails = [
    ...new Set(parsed.data.rows.map((r) => r.assignedToEmail).filter(Boolean) as string[]),
  ]
  const assignees = assigneeEmails.length
    ? await prisma.user.findMany({
        where: { orgId, email: { in: assigneeEmails }, status: 'active' },
        select: { id: true, email: true },
      })
    : []
  const assigneeIdByEmail = new Map(assignees.map((u) => [u.email, u.id]))

  let created = 0
  const errors: { row: number; message: string }[] = []

  for (const [index, row] of parsed.data.rows.entries()) {
    try {
      const contact = await prisma.contact.upsert({
        where: { orgId_email: { orgId, email: row.email } },
        create: {
          orgId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          source: row.source || 'Other',
          gstNumber: row.gstNumber,
          city: row.city,
          tags: row.tag ? [row.tag] : [],
          createdById: userId,
        },
        update: {}, // existing contact wins; import never overwrites
      })

      await createLeadWithDefaults({
        orgId,
        contactId: contact.id,
        companyName: row.companyName,
        priority: row.priority,
        notes: row.notes,
        source: row.source || 'CSV Import',
        assignedToId: row.assignedToEmail ? assigneeIdByEmail.get(row.assignedToEmail) : undefined,
        createdById: userId,
      })
      created++
    } catch (err) {
      errors.push({
        row: index + 1,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  await logAudit(orgId, userId, 'IMPORT', 'Lead', 'bulk', `CSV import`, {
    attempted: parsed.data.rows.length,
    created,
    failed: errors.length,
  })

  return successResponse({ created, failed: errors.length, errors })
})

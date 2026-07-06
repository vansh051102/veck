import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { LEAD_STAGES } from '@/lib/validation'
import { requirePermission, PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  extractOrgAndUserIds,
} from '@/lib/api-response'

const UpdateSettingsSchema = z.object({
  autoAssignmentEnabled: z.boolean().optional(),
  autoAssignmentRule: z.object({ rule_type: z.enum(['least_open_leads', 'round_robin']) }).optional(),
  slaDefaultHours: z.number().int().positive().max(720).optional(),
  slaWarningHours: z.number().int().positive().max(720).optional(),
  emailNotificationsEnabled: z.boolean().optional(),
})

// GET /api/v1/settings - Org settings (created with defaults on first read)
export const GET = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids

  const settings =
    (await prisma.settings.findUnique({ where: { orgId } })) ??
    (await prisma.settings.create({
      data: {
        orgId,
        workflowStages: { stages: [...LEAD_STAGES] },
        updatedBy: userId,
      },
    }))

  return successResponse(settings)
})

// PUT /api/v1/settings - Update org settings (requires SETTINGS_EDIT permission)
export const PUT = withErrorHandler(async (req: Request) => {
  const ids = extractOrgAndUserIds(req.headers)
  if (!ids) throw new UnauthorizedError('User context not found')
  const { orgId, userId } = ids
  await requirePermission(userId, PERMISSIONS.SETTINGS_EDIT)

  const body = await req.json()
  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid settings', parsed.error.flatten())
  }

  const settings = await prisma.settings.upsert({
    where: { orgId },
    create: {
      orgId,
      workflowStages: { stages: [...LEAD_STAGES] },
      updatedBy: userId,
      ...parsed.data,
    },
    update: { ...parsed.data, updatedBy: userId },
  })

  await logAudit(orgId, userId, 'UPDATE', 'Settings', settings.id, 'Org settings', parsed.data)

  return successResponse(settings)
})

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { defaultWorkflowStages, normalizeWorkflowStages } from '@/lib/workflow-stages'

const StageSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  order: z.number().int().positive(),
  terminal: z.boolean(),
  behavior: z.string().default('Default'),
  modal: z.string().default('Default'),
  slaHours: z.number().nullable().optional(),
})

const UpdateSettingsSchema = z.object({
  autoAssignmentEnabled: z.boolean().optional(),
  autoAssignmentRule: z
    .object({ rule_type: z.enum(['least_open_leads', 'round_robin']) })
    .optional(),
  slaDefaultHours: z.number().int().positive().max(720).optional(),
  slaWarningHours: z.number().int().positive().max(720).optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  workflowStages: z.object({ stages: z.array(StageSchema).min(1) }).optional(),
  moduleAccess: z.record(z.boolean()).optional(),
  roleHierarchy: z
    .array(
      z.object({
        roleId: z.string().uuid(),
        parentRoleId: z.string().uuid().nullable().optional(),
      })
    )
    .optional(),
})

const DEFAULT_MODULE_ACCESS = {
  leads: true,
  lead_message_logs: true,
  contacts: true,
  lead_generation_campaigns: false,
  customer_folders: true,
  auto_create_folders: true,
  quotations: true,
}

// GET /api/v1/settings
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx

  let settings = await prisma.settings.findUnique({ where: { orgId } })
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        orgId,
        workflowStages: { stages: defaultWorkflowStages() } as unknown as Prisma.InputJsonValue,
        moduleAccess: DEFAULT_MODULE_ACCESS as Prisma.InputJsonValue,
        roleHierarchy: [] as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    })
  }

  return successResponse({
    ...settings,
    workflowStages: { stages: normalizeWorkflowStages(settings.workflowStages) },
    moduleAccess: (settings.moduleAccess as Record<string, boolean>) ?? DEFAULT_MODULE_ACCESS,
    roleHierarchy: settings.roleHierarchy ?? [],
  })
})

// PUT /api/v1/settings
export const PUT = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid settings', parsed.error.flatten())
  }

  if (parsed.data.workflowStages) {
    for (const stage of parsed.data.workflowStages.stages) {
      if (stage.terminal) continue
      // non-terminal stages ok
    }
  }

  const settings = await prisma.settings.upsert({
    where: { orgId },
    create: {
      orgId,
      workflowStages: (parsed.data.workflowStages ?? {
        stages: defaultWorkflowStages(),
      }) as unknown as Prisma.InputJsonValue,
      moduleAccess: (parsed.data.moduleAccess ??
        DEFAULT_MODULE_ACCESS) as Prisma.InputJsonValue,
      roleHierarchy: (parsed.data.roleHierarchy ?? []) as Prisma.InputJsonValue,
      updatedBy: userId,
      autoAssignmentEnabled: parsed.data.autoAssignmentEnabled,
      autoAssignmentRule: parsed.data.autoAssignmentRule as Prisma.InputJsonValue | undefined,
      slaDefaultHours: parsed.data.slaDefaultHours,
      slaWarningHours: parsed.data.slaWarningHours,
      emailNotificationsEnabled: parsed.data.emailNotificationsEnabled,
    },
    update: {
      ...(parsed.data as Prisma.SettingsUpdateInput),
      updatedBy: userId,
    },
  })

  await logAudit(orgId, userId, 'UPDATE', 'Settings', settings.id, 'Org settings', parsed.data)

  return successResponse({
    ...settings,
    workflowStages: { stages: normalizeWorkflowStages(settings.workflowStages) },
  })
})

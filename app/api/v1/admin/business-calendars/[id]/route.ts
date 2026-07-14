import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

const DayWindowSchema = z.object({ start: z.string(), end: z.string() }).nullable()

const UpdateBusinessCalendarSchema = z.object({
  branch: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1).optional(),
  workingHours: z
    .object({
      mon: DayWindowSchema.optional(),
      tue: DayWindowSchema.optional(),
      wed: DayWindowSchema.optional(),
      thu: DayWindowSchema.optional(),
      fri: DayWindowSchema.optional(),
      sat: DayWindowSchema.optional(),
      sun: DayWindowSchema.optional(),
    })
    .optional(),
  holidays: z.array(z.string()).optional(),
  halfDays: z.record(DayWindowSchema).nullable().optional(),
  isDefault: z.boolean().optional(),
})

interface Params {
  params: { id: string }
}

// PUT /api/v1/admin/business-calendars/:id
export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.businessCalendar.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Business calendar')

  const body = await req.json()
  const parsed = UpdateBusinessCalendarSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid business calendar', parsed.error.flatten())
  }

  const calendar = await prisma.businessCalendar.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      workingHours: parsed.data.workingHours as Prisma.InputJsonValue | undefined,
      halfDays: parsed.data.halfDays as Prisma.InputJsonValue | undefined,
    },
  })

  await logAudit(
    ctx.orgId,
    ctx.userId,
    'UPDATE',
    'BusinessCalendar',
    calendar.id,
    calendar.branch ?? 'Default',
    parsed.data
  )

  return successResponse(calendar)
})

// DELETE /api/v1/admin/business-calendars/:id
export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.businessCalendar.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Business calendar')

  await prisma.businessCalendar.delete({ where: { id: params.id } })

  await logAudit(ctx.orgId, ctx.userId, 'DELETE', 'BusinessCalendar', existing.id, existing.branch ?? 'Default')

  return successResponse({ id: existing.id, deleted: true })
})

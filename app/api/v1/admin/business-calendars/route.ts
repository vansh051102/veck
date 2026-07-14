import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'

const DayWindowSchema = z.object({ start: z.string(), end: z.string() }).nullable()

const CreateBusinessCalendarSchema = z.object({
  branch: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1).optional(),
  workingHours: z.object({
    mon: DayWindowSchema.optional(),
    tue: DayWindowSchema.optional(),
    wed: DayWindowSchema.optional(),
    thu: DayWindowSchema.optional(),
    fri: DayWindowSchema.optional(),
    sat: DayWindowSchema.optional(),
    sun: DayWindowSchema.optional(),
  }),
  holidays: z.array(z.string()).optional(),
  halfDays: z.record(DayWindowSchema).nullable().optional(),
  isDefault: z.boolean().optional(),
})

// GET /api/v1/admin/business-calendars - List business calendars for the org.
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const calendars = await prisma.businessCalendar.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'asc' },
  })
  return successResponse(calendars)
})

// POST /api/v1/admin/business-calendars - Create a working-hours/holiday calendar.
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateBusinessCalendarSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid business calendar', parsed.error.flatten())
  }

  const calendar = await prisma.businessCalendar.create({
    data: {
      orgId: ctx.orgId,
      branch: parsed.data.branch,
      timezone: parsed.data.timezone,
      workingHours: parsed.data.workingHours as Prisma.InputJsonValue,
      holidays: parsed.data.holidays ?? [],
      halfDays: parsed.data.halfDays as Prisma.InputJsonValue | undefined,
      isDefault: parsed.data.isDefault,
    },
  })

  await logAudit(ctx.orgId, ctx.userId, 'CREATE', 'BusinessCalendar', calendar.id, calendar.branch ?? 'Default')

  return successResponse(calendar, { statusCode: 201 })
})

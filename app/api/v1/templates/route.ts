import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
  body: z.string().min(1),
  stageKey: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/v1/templates
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_READ
  )

  const templates = await prisma.messageTemplate.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { updatedAt: 'desc' },
  })

  return successResponse(templates)
})

// POST /api/v1/templates
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid template', parsed.error.flatten())
  }

  const template = await prisma.messageTemplate.create({
    data: {
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      name: parsed.data.name,
      channel: parsed.data.channel,
      body: parsed.data.body,
      stageKey: parsed.data.stageKey ?? null,
      isActive: parsed.data.isActive ?? true,
    },
  })

  return successResponse(template, { statusCode: 201 })
})

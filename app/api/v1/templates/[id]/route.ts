import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/rbac'
import {
  successResponse,
  withErrorHandler,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

interface Params {
  params: { id: string }
}

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(['whatsapp', 'email', 'sms']).optional(),
  body: z.string().min(1).optional(),
  stageKey: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const PUT = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.messageTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Template')

  const body = await req.json()
  const parsed = UpdateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid template', parsed.error.flatten())
  }

  const template = await prisma.messageTemplate.update({
    where: { id: params.id },
    data: parsed.data,
  })

  return successResponse(template)
})

export const DELETE = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const existing = await prisma.messageTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
  })
  if (!existing) throw new NotFoundError('Template')

  await prisma.messageTemplate.delete({ where: { id: params.id } })
  return successResponse({ id: params.id, deleted: true })
})

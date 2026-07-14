import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError, ConflictError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'

// Only the fields a saved key touches — one key per request, matches one
// card's "Save" button on the Integrations tab.
const UpdateIntegrationSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('indiamart'), webhookSecret: z.string().min(1).nullable() }),
  z.object({ provider: z.literal('tradeindia'), webhookSecret: z.string().min(1).nullable() }),
  z.object({
    provider: z.literal('whatsapp'),
    verifyToken: z.string().min(1).nullable(),
    appSecret: z.string().min(1).nullable(),
    phoneNumberId: z.string().min(1).nullable(),
  }),
  z.object({ provider: z.literal('email'), webhookSecret: z.string().min(1).nullable() }),
  z.object({ provider: z.literal('justdial'), apiKey: z.string().min(1).nullable() }),
])

function mask(secret: string | null): string | null {
  if (!secret) return null
  return secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`
}

// GET /api/v1/settings/integrations - Configured status + masked secrets
// for each lead-source integration, for the Integrations tab.
export const GET = withErrorHandler(async (req: Request) => {
  const { orgId } = await validateRequest(req)

  const settings = await prisma.settings.findUnique({
    where: { orgId },
    select: {
      indiamartWebhookSecret: true,
      tradeindiaWebhookSecret: true,
      whatsappVerifyToken: true,
      whatsappAppSecret: true,
      whatsappPhoneNumberId: true,
      emailInboundSecret: true,
      justdialApiKey: true,
    },
  })

  return successResponse({
    indiamart: { configured: Boolean(settings?.indiamartWebhookSecret), webhookSecret: mask(settings?.indiamartWebhookSecret ?? null) },
    tradeindia: { configured: Boolean(settings?.tradeindiaWebhookSecret), webhookSecret: mask(settings?.tradeindiaWebhookSecret ?? null) },
    whatsapp: {
      configured: Boolean(settings?.whatsappVerifyToken && settings?.whatsappAppSecret && settings?.whatsappPhoneNumberId),
      verifyToken: mask(settings?.whatsappVerifyToken ?? null),
      appSecret: mask(settings?.whatsappAppSecret ?? null),
      phoneNumberId: settings?.whatsappPhoneNumberId ?? null,
    },
    email: { configured: Boolean(settings?.emailInboundSecret), webhookSecret: mask(settings?.emailInboundSecret ?? null) },
    justdial: { configured: Boolean(settings?.justdialApiKey), apiKey: mask(settings?.justdialApiKey ?? null) },
  })
})

// PUT /api/v1/settings/integrations - Save/clear one integration's key(s).
// Pass a field as null to clear it. Webhook secrets are auto-generated when
// omitted/undefined on first save so the admin doesn't have to invent one —
// the returned `webhookSecret` is the value to paste into the vendor's
// dashboard, and is only ever shown once at save time.
export const PUT = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { orgId, userId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(userId), PERMISSIONS.SETTINGS_EDIT)

  const body = await req.json()
  const parsed = UpdateIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid integration settings', parsed.error.flatten())
  }
  const input = parsed.data

  await prisma.settings.upsert({
    where: { orgId },
    create: { orgId, workflowStages: { stages: [] } as unknown as Prisma.InputJsonValue, updatedBy: userId },
    update: {},
  })

  const data: Prisma.SettingsUpdateInput = { updatedBy: userId }
  let generatedSecret: string | null = null

  try {
    switch (input.provider) {
      case 'indiamart':
        data.indiamartWebhookSecret = input.webhookSecret ?? (generatedSecret = randomBytes(24).toString('hex'))
        data.indiamartConfiguredBy = input.webhookSecret === null ? null : userId
        break
      case 'tradeindia':
        data.tradeindiaWebhookSecret = input.webhookSecret ?? (generatedSecret = randomBytes(24).toString('hex'))
        data.tradeindiaConfiguredBy = input.webhookSecret === null ? null : userId
        break
      case 'whatsapp':
        data.whatsappVerifyToken = input.verifyToken
        data.whatsappAppSecret = input.appSecret
        data.whatsappPhoneNumberId = input.phoneNumberId
        data.whatsappConfiguredBy = input.verifyToken || input.appSecret || input.phoneNumberId ? userId : null
        break
      case 'email':
        data.emailInboundSecret = input.webhookSecret ?? (generatedSecret = randomBytes(24).toString('hex'))
        data.emailConfiguredBy = input.webhookSecret === null ? null : userId
        break
      case 'justdial':
        data.justdialApiKey = input.apiKey
        data.justdialConfiguredBy = input.apiKey ? userId : null
        break
    }

    const settings = await prisma.settings.update({ where: { orgId }, data })

    await logAudit(orgId, userId, 'UPDATE', 'Settings', settings.id, `Integration: ${input.provider}`, {
      provider: input.provider,
    })

    return successResponse({ provider: input.provider, generatedSecret })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('That secret is already in use by another workspace — try again')
    }
    throw error
  }
})

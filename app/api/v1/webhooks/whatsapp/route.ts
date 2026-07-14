import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { WhatsAppWebhookSchema } from '@/lib/validation'
import { rateLimitResponse } from '@/lib/rate-limit'
import { webhookLimiter } from '@/lib/rate-limit-db'
import { normalizePhone } from '@/lib/normalize'

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const provided = signatureHeader.slice('sha256='.length)
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

function placeholderEmail(waId: string): string {
  return `phone-${waId}@leads.whatsapp.veck.internal`
}

async function findOrCreateContact(orgId: string, createdById: string, waId: string, name: string | undefined) {
  const phone = normalizePhone(waId)
  const [firstName, ...rest] = (name || 'WhatsApp Buyer').trim().split(/\s+/)
  const lastName = rest.join(' ') || '-'

  const existing = await prisma.contact.findFirst({ where: { orgId, phone } })
  if (existing) return existing

  return prisma.contact.create({
    data: {
      orgId,
      firstName,
      lastName,
      email: placeholderEmail(waId),
      phone,
      source: 'WhatsApp Business',
      createdById,
    },
  })
}

// GET /api/v1/webhooks/whatsapp - Meta's Cloud API webhook verification
// handshake. Meta calls this once when you register the webhook URL in the
// App Dashboard, with ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// Every org shares this one callback URL (Meta only allows one per app), so
// the verify token is checked against ANY org that has one configured —
// whichever org set up WhatsApp first "owns" the app-level handshake.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  const match = await prisma.settings.findFirst({
    where: { whatsappVerifyToken: token },
    select: { id: true },
  })
  if (!match) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

// POST /api/v1/webhooks/whatsapp - Receives inbound message events from
// Meta's WhatsApp Cloud API and creates a Contact + Lead for the sender.
//
// Meta requires one fixed callback URL per app (no path secret like the
// other webhooks), so org resolution works differently here: the payload's
// `metadata.phone_number_id` identifies which org's WhatsApp number received
// the message, looked up against Settings.whatsappPhoneNumberId (unique).
// The request is only trusted once its X-Hub-Signature-256 is verified
// against THAT org's whatsappAppSecret — phone_number_id is read from the
// unverified body first purely to pick which secret to verify against, the
// same as any multi-tenant webhook where the identifying key arrives before
// the signature check.
export async function POST(req: Request) {
  const { allowed, retryAfter } = await webhookLimiter.check(req)
  if (!allowed) return rateLimitResponse(retryAfter)

  const rawBody = await req.text()
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const phoneNumberId: string | undefined = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
  if (!phoneNumberId) {
    // Status-only callbacks (delivered/read receipts) may omit metadata entirely — ack and skip.
    return NextResponse.json({ success: true, status: 'ignored' })
  }

  const settings = await prisma.settings.findFirst({
    where: { whatsappPhoneNumberId: phoneNumberId },
    select: { orgId: true, whatsappAppSecret: true, whatsappConfiguredBy: true },
  })
  if (!settings?.whatsappAppSecret || !settings.whatsappConfiguredBy) {
    return NextResponse.json({ error: 'Unknown WhatsApp number' }, { status: 401 })
  }

  if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'), settings.whatsappAppSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { orgId, whatsappConfiguredBy: systemUserId } = settings

  const parsed = WhatsAppWebhookSchema.safeParse(body)
  if (!parsed.success) {
    console.error('WhatsApp webhook payload validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const messages = parsed.data.entry.flatMap((entry) => entry.changes.flatMap((change) => change.value.messages ?? []))
  const contacts = parsed.data.entry.flatMap((entry) => entry.changes.flatMap((change) => change.value.contacts ?? []))

  if (messages.length === 0) {
    // Status callbacks (delivered/read receipts) have no `messages` array — ack and skip.
    return NextResponse.json({ success: true, status: 'ignored' })
  }

  try {
    const results = []
    for (const message of messages) {
      const existingLead = await prisma.lead.findFirst({
        where: { orgId, externalId: message.id },
        select: { id: true },
      })
      if (existingLead) {
        results.push({ messageId: message.id, status: 'duplicate_skipped', leadId: existingLead.id })
        continue
      }

      const contactInfo = contacts.find((c) => c.wa_id === message.from)
      const contact = await findOrCreateContact(orgId, systemUserId, message.from, contactInfo?.profile?.name)

      const result = await createLeadWithDefaults({
        orgId,
        contactId: contact.id,
        companyName: contactInfo?.profile?.name || contact.phone,
        priority: 'Medium',
        notes: message.text?.body,
        source: 'WhatsApp Business',
        sourceDetails: { waId: message.from, type: message.type },
        externalId: message.id,
        createdById: systemUserId,
      })

      results.push(
        result.duplicate
          ? { messageId: message.id, status: 'duplicate_linked', leadId: result.existingLead.id }
          : { messageId: message.id, status: 'created', leadId: result.lead.id }
      )
    }

    return NextResponse.json({ success: true, results }, { status: 201 })
  } catch (error) {
    console.error('WhatsApp webhook processing error:', error)
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}

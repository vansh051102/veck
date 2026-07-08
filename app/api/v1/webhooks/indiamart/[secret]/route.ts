import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { IndiaMartWebhookSchema, type IndiaMartLeadResponse } from '@/lib/validation'
import { webhookLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { secureEqual } from '@/lib/secure-compare'

interface Params {
  params: { secret: string }
}

function placeholderEmail(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '') || 'unknown'
  return `phone-${digits}@leads.indiamart.veck.internal`
}

function resolveRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Configure INDIAMART_ORG_ID, INDIAMART_SYSTEM_USER_ID, and INDIAMART_WEBHOOK_SECRET.`
    )
  }
  return value
}

async function findOrCreateContact(orgId: string, createdById: string, lead: IndiaMartLeadResponse) {
  const email = lead.SENDER_EMAIL
  const phone = lead.SENDER_MOBILE || lead.SENDER_PHONE || ''
  const [firstName, ...rest] = (lead.SENDER_NAME || 'IndiaMART Buyer').trim().split(/\s+/)
  const lastName = rest.join(' ') || '-'

  const existing = email
    ? await prisma.contact.findFirst({ where: { orgId, email } })
    : await prisma.contact.findFirst({ where: { orgId, phone } })

  if (existing) return existing

  return prisma.contact.create({
    data: {
      orgId,
      firstName,
      lastName,
      email: email || placeholderEmail(phone),
      phone: phone || 'Not provided',
      alternatePhone: lead.SENDER_MOBILE_ALT,
      source: 'IndiaMART',
      sourceDetails: { queryMcatName: lead.QUERY_MCAT_NAME, city: lead.SENDER_CITY, state: lead.SENDER_STATE },
      createdById,
    },
  })
}

// POST /api/v1/webhooks/indiamart/:secret - Receives real-time leads from
// IndiaMART's Lead Manager CRM Push API and creates a Contact + Lead.
//
// This route is intentionally unauthenticated (no user session exists for a
// server-to-server webhook) - the `secret` path segment is the access
// control instead, checked against INDIAMART_WEBHOOK_SECRET. It must be
// listed in middleware.ts's PUBLIC_ROUTES.
//
// Requires the following environment variables:
//   - INDIAMART_WEBHOOK_SECRET: The shared secret from IndiaMART
//   - INDIAMART_ORG_ID: The organization ID to attach leads to
//   - INDIAMART_SYSTEM_USER_ID: The user ID to attribute lead creation to
//
// IndiaMART deactivates the Push API integration if it doesn't see HTTP 200
// for 48 continuous hours, so this always returns 200 for well-formed,
// correctly-authenticated requests - including "already processed" (dedup)
// and "org/user not configured yet" cases - reserving non-200 for auth
// failures and malformed payloads, which ARE worth IndiaMART retrying/alerting on.
export async function POST(req: Request, { params }: Params) {
  // Rate limit: 30 webhook calls per minute per IP
  const { allowed, retryAfter } = webhookLimiter.check(req)
  if (!allowed) return rateLimitResponse(retryAfter)

  // Validate webhook secret — required, no fallback
  let webhookSecret: string
  try {
    webhookSecret = resolveRequiredEnv('INDIAMART_WEBHOOK_SECRET')
  } catch (error) {
    console.error('IndiaMART webhook misconfigured:', error)
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!secureEqual(params.secret, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = IndiaMartWebhookSchema.safeParse(body)
  if (!parsed.success) {
    console.error('IndiaMART webhook payload validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }
  const lead = parsed.data.RESPONSE

  try {
    // Dedup: IndiaMART's UNIQUE_QUERY_ID is the idempotency key
    const existingLead = await prisma.lead.findUnique({ where: { externalId: lead.UNIQUE_QUERY_ID } })
    if (existingLead) {
      return NextResponse.json({ success: true, status: 'duplicate_skipped', leadId: existingLead.id })
    }

    // Resolve org and system user — required env vars, fail fast
    const orgId = resolveRequiredEnv('INDIAMART_ORG_ID')
    const systemUserId = resolveRequiredEnv('INDIAMART_SYSTEM_USER_ID')

    // Validate that org and user actually exist in DB
    const [org, user] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }),
      prisma.user.findFirst({ where: { id: systemUserId, orgId }, select: { id: true } }),
    ])

    if (!org) {
      console.error(`IndiaMART webhook: configured ORG_ID ${orgId} does not exist`)
      return NextResponse.json({ error: 'Organization not found' }, { status: 500 })
    }
    if (!user) {
      console.error(`IndiaMART webhook: configured SYSTEM_USER_ID ${systemUserId} not found in org ${orgId}`)
      return NextResponse.json({ error: 'System user not found' }, { status: 500 })
    }

    const contact = await findOrCreateContact(orgId, systemUserId, lead)

    const result = await createLeadWithDefaults({
      orgId,
      contactId: contact.id,
      companyName: lead.SENDER_COMPANY || lead.SENDER_NAME || 'Unknown Company',
      priority: 'Medium',
      notes: lead.QUERY_MESSAGE,
      source: 'IndiaMART',
      sourceDetails: { ...lead },
      externalId: lead.UNIQUE_QUERY_ID,
      tags: lead.QUERY_PRODUCT_NAME ? [lead.QUERY_PRODUCT_NAME] : [],
      createdById: systemUserId,
    })

    if (result.duplicate) {
      // Auto-link: create a timeline event on the existing lead so the
      // assignee knows this buyer re-submitted via IndiaMART.
      const timeline = await prisma.timeline.upsert({
        where: { leadId: result.existingLead.id },
        create: { leadId: result.existingLead.id },
        update: {},
      })
      await prisma.timelineEvent.create({
        data: {
          timelineId: timeline.id,
          type: 're_submission',
          title: `Re-submitted via IndiaMART — source: ${lead.SENDER_NAME || 'Buyer'}`,
          description: `Buyer ${lead.SENDER_NAME} submitted again. Already assigned to ${result.existingLead.assignedTo?.fullName ?? 'someone'}.`,
          metadata: { queryMessage: lead.QUERY_MESSAGE, productName: lead.QUERY_PRODUCT_NAME },
          createdBy: systemUserId,
        },
      })
      return NextResponse.json(
        { success: true, status: 'duplicate_linked', leadId: result.existingLead.id },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true, status: 'created', leadId: result.lead.id }, { status: 201 })
  } catch (error) {
    console.error('IndiaMART webhook processing error:', error)
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}

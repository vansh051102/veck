import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLeadWithDefaults } from '@/lib/lead-creation'
import { IndiaMartWebhookSchema, type IndiaMartLeadResponse } from '@/lib/validation'

interface Params {
  params: { secret: string }
}

// Deterministic placeholder so leads from the same phone number (but no
// email) resolve to the same Contact instead of creating a new one every
// time IndiaMART pushes another lead for that buyer.
function placeholderEmail(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '') || 'unknown'
  return `phone-${digits}@leads.indiamart.veck.internal`
}

async function resolveOrgId(): Promise<string | null> {
  if (process.env.INDIAMART_ORG_ID) return process.env.INDIAMART_ORG_ID
  // Single-tenant fallback: if there's exactly one org (the common case for
  // this deployment), use it so the webhook works without extra config.
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
  return org?.id ?? null
}

async function resolveSystemUserId(orgId: string): Promise<string | null> {
  if (process.env.INDIAMART_SYSTEM_USER_ID) return process.env.INDIAMART_SYSTEM_USER_ID
  // Attribute webhook-created records to the org's earliest user (typically
  // the admin who signed up) since Lead/Contact.createdById is required and
  // there's no logged-in user for an inbound webhook.
  const user = await prisma.user.findFirst({ where: { orgId }, orderBy: { createdAt: 'asc' } })
  return user?.id ?? null
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
// IndiaMART deactivates the Push API integration if it doesn't see HTTP 200
// for 48 continuous hours, so this always returns 200 for well-formed,
// correctly-authenticated requests - including "already processed" (dedup)
// and "org/user not configured yet" cases - reserving non-200 for auth
// failures and malformed payloads, which ARE worth IndiaMART retrying/alerting on.
export async function POST(req: Request, { params }: Params) {
  if (!process.env.INDIAMART_WEBHOOK_SECRET || params.secret !== process.env.INDIAMART_WEBHOOK_SECRET) {
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
    // Dedup: IndiaMART's UNIQUE_QUERY_ID is the idempotency key. If this
    // lead was already ingested (e.g. IndiaMART retried a push we did
    // acknowledge, or this endpoint got called twice), skip silently.
    const existingLead = await prisma.lead.findUnique({ where: { externalId: lead.UNIQUE_QUERY_ID } })
    if (existingLead) {
      return NextResponse.json({ success: true, status: 'duplicate_skipped', leadId: existingLead.id })
    }

    const orgId = await resolveOrgId()
    if (!orgId) {
      console.error('IndiaMART webhook: no organization configured to attach leads to')
      return NextResponse.json({ success: true, status: 'no_org_configured' })
    }

    const systemUserId = await resolveSystemUserId(orgId)
    if (!systemUserId) {
      console.error('IndiaMART webhook: no user found to attribute lead creation to')
      return NextResponse.json({ success: true, status: 'no_user_configured' })
    }

    const contact = await findOrCreateContact(orgId, systemUserId, lead)

    const created = await createLeadWithDefaults({
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

    return NextResponse.json({ success: true, status: 'created', leadId: created.id }, { status: 201 })
  } catch (error) {
    console.error('IndiaMART webhook processing error:', error)
    // A genuine internal error - worth letting IndiaMART retry.
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}

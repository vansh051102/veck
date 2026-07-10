import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildQuotePdf, type QuotePdfItem } from '@/lib/quote-pdf'
import { canAccessLead, PERMISSIONS } from '@/lib/rbac'
import { withErrorHandler, NotFoundError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

function parseItems(raw: unknown): QuotePdfItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    const item = row as Record<string, unknown>
    return {
      description: String(item.productId ?? item.description ?? 'Item'),
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      discount: Number(item.discount) || 0,
    }
  })
}

// GET /api/v1/quotes/:id/pdf — draft or final quotation PDF
export const GET = withErrorHandler(async (req: Request, { params }: Params) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.QUOTES_READ
  )

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: {
      lead: {
        include: {
          contact: {
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
    },
  })
  if (!quote) throw new NotFoundError('Quote')
  if (!(await canAccessLead(ctx.userId, ctx.role, quote.leadId))) {
    throw new NotFoundError('Quote')
  }

  const org = await prisma.organization.findFirst({
    where: { id: ctx.orgId },
    select: {
      name: true,
      address: true,
      gstin: true,
      pan: true,
      phone: true,
      email: true,
    },
  })
  if (!org) throw new NotFoundError('Organization')

  const contact = quote.lead.contact
  const contactName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : null

  const pdf = await buildQuotePdf({
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    validUntil: quote.validUntil,
    notes: quote.notes,
    terms: quote.terms,
    items: parseItems(quote.items),
    totalAmount: Number(quote.totalAmount),
    discount: Number(quote.discount),
    finalAmount: Number(quote.finalAmount),
    supplier: {
      name: org.name,
      address: org.address,
      gstin: org.gstin,
      pan: org.pan,
      phone: org.phone,
      email: org.email,
    },
    buyer: {
      companyName: quote.lead.companyName,
      contactName,
      phone: contact?.phone,
      email: contact?.email,
    },
  })

  const filename = `${quote.quoteNumber}${quote.status === 'draft' ? '-draft' : ''}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

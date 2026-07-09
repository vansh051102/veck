import type { Prisma } from '@prisma/client'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { nextSalesOrderNumber } from '@/lib/numbering'
import { priceItems, assertProductsInOrg } from './sales-order.service'
import { reserveStock } from './stock-ledger.service'
import { enqueue as tallyEnqueue } from './tally-sync.service'
import type { ConvertLeadInput } from '../../actions/erp/schemas'

// ============================================================================
// CRM → ERP CONVERSION (mandate #3)
// ============================================================================
// Lead → Customer + draft SalesOrder in a single transaction. Caller wraps this
// in prisma.$transaction, so every write here commits or rolls back together —
// including the SO number (nextSalesOrderNumber MUST receive `tx`).

interface Ctx {
  orgId: string
  userId: string
}

export async function convertLead(
  tx: Prisma.TransactionClient,
  ctx: Ctx,
  input: ConvertLeadInput
) {
  // 1. Load the lead scoped to tenant, with its contact
  const lead = await tx.lead.findFirst({
    where: { id: input.leadId, orgId: ctx.orgId },
    include: { contact: true },
  })
  if (!lead) throw new NotFoundError('Lead')

  // 2. Idempotency — never convert twice
  if (lead.convertedCustomerId) {
    throw new ConflictError('Lead has already been converted to a customer')
  }

  // 3. Cross-tenant safety: every ordered product must exist in this org
  await assertProductsInOrg(
    tx,
    ctx.orgId,
    input.items.map((i) => i.productId)
  )

  // 4. Customer from Lead + Contact + the address fields the input supplies
  const c = lead.contact
  const customer = await tx.customer.create({
    data: {
      orgId: ctx.orgId,
      name: lead.companyName,
      contactPerson: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      gstNumber: c.gstNumber,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      type: input.customerType,
      creditLimit: input.creditLimit,
    },
  })

  // 5. Atomic SO number — tx client so it rolls back with the transaction
  const soNumber = await nextSalesOrderNumber(tx, ctx.orgId)

  // 6. Price the lines (pure)
  const priced = priceItems(input.items)

  // 7. SalesOrder (draft) + nested items
  const salesOrder = await tx.salesOrder.create({
    data: {
      orgId: ctx.orgId,
      soNumber,
      customerId: customer.id,
      subtotal: priced.subtotal,
      discount: priced.discount,
      tax: priced.tax,
      totalAmount: priced.totalAmount,
      deliveryAddress: input.deliveryAddress ?? input.address,
      deliveryDate: input.deliveryDate,
      assignedToId: lead.assignedToId,
      createdBy: ctx.userId,
      items: {
        create: priced.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          tax: l.tax,
          totalPrice: l.totalPrice,
        })),
      },
    },
  })

  // 8. Reserve stock for each line (reservation ≠ physical OUT)
  for (const l of priced.lines) {
    await reserveStock(tx, ctx, l.productId, l.quantity)
  }

  // 9. Close the loop on the Lead (idempotency stamps + won status)
  await tx.lead.update({
    where: { id: lead.id },
    data: {
      convertedCustomerId: customer.id,
      convertedSalesOrderId: salesOrder.id,
      convertedAt: new Date(),
      status: 'closed_won',
      stage: 'Closed Won',
    },
  })

  // 10. Enqueue the SO for Tally push (idempotent)
  await tallyEnqueue(tx, {
    orgId: ctx.orgId,
    entityType: 'sales_order',
    entityId: salesOrder.id,
    createdBy: ctx.userId,
  })

  return { customer, salesOrder }
}

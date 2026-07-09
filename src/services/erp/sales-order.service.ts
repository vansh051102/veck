import type { Prisma } from '@prisma/client'
import { NotFoundError } from '@/lib/errors'
import type { OrderItemInput } from '../../actions/erp/schemas'

// ============================================================================
// SALES ORDER DOMAIN HELPERS (pure pricing + tenant safety)
// ============================================================================

export interface PricedLine {
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  tax: number
  totalPrice: number
}

export interface PricedOrder {
  subtotal: number // sum of line gross (unitPrice × qty), before discount/tax
  discount: number
  tax: number
  totalAmount: number // subtotal − discount + tax
  lines: PricedLine[]
}

// Money math in integer paise, then back to rupees — avoids float drift on the
// order total. Quantities are ints; prices carry 2 decimals.
const toPaise = (n: number) => Math.round(n * 100)
const toRupees = (p: number) => p / 100

export function priceItems(items: OrderItemInput[]): PricedOrder {
  let subtotalP = 0
  let discountP = 0
  let taxP = 0

  const lines = items.map((it) => {
    const grossP = toPaise(it.unitPrice) * it.quantity
    const lineDiscountP = toPaise(it.discount)
    const baseP = grossP - lineDiscountP
    const lineTaxP = Math.round((baseP * it.taxRate) / 100)

    subtotalP += grossP
    discountP += lineDiscountP
    taxP += lineTaxP

    return {
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      tax: toRupees(lineTaxP),
      totalPrice: toRupees(baseP + lineTaxP),
    }
  })

  return {
    subtotal: toRupees(subtotalP),
    discount: toRupees(discountP),
    tax: toRupees(taxP),
    totalAmount: toRupees(subtotalP - discountP + taxP),
    lines,
  }
}

// Security boundary: every ordered product must exist AND belong to this org —
// blocks cross-tenant product references before we create the order.
export async function assertProductsInOrg(
  tx: Prisma.TransactionClient,
  orgId: string,
  productIds: string[]
): Promise<void> {
  const ids = Array.from(new Set(productIds))
  const found = await tx.product.findMany({
    where: { id: { in: ids }, orgId },
    select: { id: true },
  })
  if (found.length !== ids.length) {
    const foundSet = new Set(found.map((p) => p.id))
    const missing = ids.filter((id) => !foundSet.has(id))
    throw new NotFoundError(`Product(s) ${missing.join(', ')}`)
  }
}

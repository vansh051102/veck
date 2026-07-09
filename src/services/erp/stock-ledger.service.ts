import type { Prisma } from '@prisma/client'
import { ValidationError } from '@/lib/errors'

// ============================================================================
// STOCK LEDGER (auditable inventory — mandate #4)
// ============================================================================
// The ONLY writer of stock. Every mutation is one immutable StockMovement row
// carrying the balance it produced; Inventory.currentStock is the cached tail of
// that ledger. There is no update/delete path here — that is what makes the
// ledger auditable. ponytail: immutability is a service-layer invariant; add a
// DB trigger only if direct SQL writes become a real threat.

interface Ctx {
  orgId: string
  userId: string
}

export interface MovementInput {
  productId: string
  direction: 'IN' | 'OUT'
  quantity: number // always positive
  reason: string // purchase_receipt | sale | adjustment | return | transfer
  reference: string // SO-001, PO-001, GR-001
  referenceType: string // sales_order | purchase_order | goods_receipt | manual
  unitCost?: number
  notes?: string
}

export async function recordMovement(
  tx: Prisma.TransactionClient,
  ctx: Ctx,
  m: MovementInput
) {
  // Ensure the Inventory row exists (1:1 with Product)
  const inv = await tx.inventory.upsert({
    where: { productId: m.productId },
    create: { orgId: ctx.orgId, productId: m.productId, currentStock: 0 },
    update: {},
  })

  const delta = m.direction === 'IN' ? m.quantity : -m.quantity
  const balanceAfter = inv.currentStock + delta
  if (balanceAfter < 0) {
    throw new ValidationError(
      `Insufficient stock for product ${m.productId}: have ${inv.currentStock}, requested OUT ${m.quantity}`
    )
  }

  // Update the cached balance in the same transaction as the ledger append
  await tx.inventory.update({
    where: { id: inv.id },
    data: {
      currentStock: balanceAfter,
      ...(m.direction === 'IN' ? { lastRestockDate: new Date() } : {}),
    },
  })

  return tx.stockMovement.create({
    data: {
      orgId: ctx.orgId,
      productId: m.productId,
      inventoryId: inv.id,
      direction: m.direction,
      reason: m.reason,
      quantity: m.quantity,
      balanceAfter,
      unitCost: m.unitCost ?? null,
      reference: m.reference,
      referenceType: m.referenceType,
      notes: m.notes ?? null,
      createdBy: ctx.userId,
    },
  })
}

// Reservation ≠ physical movement. Bumps Inventory.reserved only; the OUT
// StockMovement fires later, on shipment. ponytail: no availability guard —
// draft SOs may precede stock arrival (backorder). Add a `reserved <=
// currentStock` check here if oversell must be blocked.
export async function reserveStock(
  tx: Prisma.TransactionClient,
  ctx: Ctx,
  productId: string,
  quantity: number
) {
  return tx.inventory.upsert({
    where: { productId },
    create: { orgId: ctx.orgId, productId, currentStock: 0, reserved: quantity },
    update: { reserved: { increment: quantity } },
  })
}

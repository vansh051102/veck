'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/permissions'
import { ValidationError } from '@/lib/errors'
import { getActionContext } from './_context'
import { withAction } from './_result'
import { RecordStockMovementSchema } from './schemas'
import { recordMovement } from '../../services/erp/stock-ledger.service'

// Append one immutable stock movement and update the cached Inventory balance.
export const recordStockMovement = withAction(async (raw: unknown) => {
  const ctx = await getActionContext()
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_EDIT
  )

  const parsed = RecordStockMovementSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError('Invalid stock movement', parsed.error.flatten())
  }
  const m = parsed.data

  const movement = await prisma.$transaction((tx) => recordMovement(tx, ctx, m))

  await logAudit(
    ctx.orgId,
    ctx.userId,
    'STOCK_MOVEMENT',
    'StockMovement',
    movement.id,
    m.reference,
    {
      productId: m.productId,
      direction: m.direction,
      quantity: m.quantity,
      balanceAfter: movement.balanceAfter,
    }
  )
  revalidatePath('/inventory')

  return movement
})

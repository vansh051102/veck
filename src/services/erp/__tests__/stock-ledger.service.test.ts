import { recordMovement, reserveStock } from '../stock-ledger.service'

const ctx = { orgId: 'org', userId: 'u1' }

function makeTx() {
  return {
    inventory: {
      upsert: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
      // present so the test can assert the ledger never mutates existing rows
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  }
}

describe('recordMovement', () => {
  it('IN: adds to balance, records balanceAfter, stamps lastRestockDate, and never mutates prior rows', async () => {
    const tx = makeTx()
    tx.inventory.upsert.mockResolvedValue({ id: 'inv-1', currentStock: 10 })

    await recordMovement(tx as any, ctx, {
      productId: 'p1',
      direction: 'IN',
      quantity: 5,
      reason: 'purchase_receipt',
      reference: 'GR-1',
      referenceType: 'goods_receipt',
    })

    expect(tx.inventory.update.mock.calls[0][0].data.currentStock).toBe(15)
    expect(tx.inventory.update.mock.calls[0][0].data.lastRestockDate).toBeInstanceOf(Date)

    const mv = tx.stockMovement.create.mock.calls[0][0].data
    expect(mv.direction).toBe('IN')
    expect(mv.balanceAfter).toBe(15)
    expect(mv.inventoryId).toBe('inv-1')

    // Append-only invariant
    expect(tx.stockMovement.update).not.toHaveBeenCalled()
    expect(tx.stockMovement.delete).not.toHaveBeenCalled()
  })

  it('OUT: subtracts from balance and does not set lastRestockDate', async () => {
    const tx = makeTx()
    tx.inventory.upsert.mockResolvedValue({ id: 'inv-1', currentStock: 10 })

    await recordMovement(tx as any, ctx, {
      productId: 'p1',
      direction: 'OUT',
      quantity: 4,
      reason: 'sale',
      reference: 'SO-1',
      referenceType: 'sales_order',
    })

    expect(tx.inventory.update.mock.calls[0][0].data.currentStock).toBe(6)
    expect(tx.inventory.update.mock.calls[0][0].data.lastRestockDate).toBeUndefined()
    expect(tx.stockMovement.create.mock.calls[0][0].data.balanceAfter).toBe(6)
  })

  it('OUT: throws when it would drive stock negative, and writes no movement', async () => {
    const tx = makeTx()
    tx.inventory.upsert.mockResolvedValue({ id: 'inv-1', currentStock: 3 })

    await expect(
      recordMovement(tx as any, ctx, {
        productId: 'p1',
        direction: 'OUT',
        quantity: 5,
        reason: 'sale',
        reference: 'SO-1',
        referenceType: 'sales_order',
      })
    ).rejects.toThrow(/Insufficient stock/)

    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })
})

describe('reserveStock', () => {
  it('increments Inventory.reserved without recording a movement', async () => {
    const tx = makeTx()
    tx.inventory.upsert.mockResolvedValue({ id: 'inv-1', reserved: 7 })

    await reserveStock(tx as any, ctx, 'p1', 7)

    const arg = tx.inventory.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ productId: 'p1' })
    expect(arg.update).toEqual({ reserved: { increment: 7 } })
    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })
})

jest.mock('@/lib/numbering', () => ({
  nextSalesOrderNumber: jest.fn().mockResolvedValue('SO-2026-001'),
}))
jest.mock('../stock-ledger.service', () => ({ reserveStock: jest.fn() }))
jest.mock('../tally-sync.service', () => ({ enqueue: jest.fn() }))

import { convertLead } from '../conversion.service'
import { nextSalesOrderNumber } from '@/lib/numbering'
import { reserveStock } from '../stock-ledger.service'
import { enqueue as tallyEnqueue } from '../tally-sync.service'

const ctx = { orgId: 'org', userId: 'u1' }

function makeTx() {
  return {
    lead: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    product: { findMany: jest.fn() },
    customer: { create: jest.fn() },
    salesOrder: { create: jest.fn() },
  }
}

const contact = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@acme.test',
  phone: '9999999999',
  gstNumber: 'GST123',
  city: 'Pune',
}

const input = {
  leadId: 'lead-1',
  address: '1 Steel Rd',
  city: 'Mumbai',
  state: 'MH',
  pincode: '400001',
  customerType: 'dealer' as const,
  creditLimit: 0,
  deliveryDate: new Date('2026-08-01T00:00:00Z'),
  items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discount: 0, taxRate: 18 }],
}

describe('convertLead', () => {
  beforeEach(() => {
    ;(nextSalesOrderNumber as jest.Mock).mockClear().mockResolvedValue('SO-2026-001')
    ;(reserveStock as jest.Mock).mockClear()
    ;(tallyEnqueue as jest.Mock).mockClear()
  })

  it('creates Customer + SalesOrder + items, prices correctly, reserves stock, enqueues Tally, stamps the lead', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      orgId: 'org',
      companyName: 'Acme Steel',
      assignedToId: 'u2',
      convertedCustomerId: null,
      contact,
    })
    tx.product.findMany.mockResolvedValue([{ id: 'prod-1' }])
    tx.customer.create.mockResolvedValue({ id: 'cust-1', name: 'Acme Steel' })
    tx.salesOrder.create.mockResolvedValue({ id: 'so-1', soNumber: 'SO-2026-001' })

    const result = await convertLead(tx as any, ctx, input)

    // SO number generated exactly once, with the tx client
    expect(nextSalesOrderNumber).toHaveBeenCalledTimes(1)
    expect(nextSalesOrderNumber).toHaveBeenCalledWith(tx, 'org')

    // Customer maps from lead + contact + supplied address
    const custData = tx.customer.create.mock.calls[0][0].data
    expect(custData.name).toBe('Acme Steel')
    expect(custData.contactPerson).toBe('Jane Doe')
    expect(custData.email).toBe('jane@acme.test')
    expect(custData.state).toBe('MH')

    // Pricing: 2 × 100 = 200 subtotal, 18% tax = 36, total 236
    const soData = tx.salesOrder.create.mock.calls[0][0].data
    expect(soData.soNumber).toBe('SO-2026-001')
    expect(soData.subtotal).toBe(200)
    expect(soData.tax).toBe(36)
    expect(soData.totalAmount).toBe(236)
    expect(soData.items.create).toHaveLength(1)
    expect(soData.items.create[0].totalPrice).toBe(236)

    // Side effects
    expect(reserveStock).toHaveBeenCalledWith(tx, ctx, 'prod-1', 2)
    expect(tallyEnqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ entityType: 'sales_order', entityId: 'so-1' })
    )

    // Lead stamped for idempotency + closed won
    const leadUpdate = tx.lead.update.mock.calls[0][0].data
    expect(leadUpdate.convertedCustomerId).toBe('cust-1')
    expect(leadUpdate.convertedSalesOrderId).toBe('so-1')
    expect(leadUpdate.status).toBe('closed_won')

    expect(result).toEqual({
      customer: { id: 'cust-1', name: 'Acme Steel' },
      salesOrder: { id: 'so-1', soNumber: 'SO-2026-001' },
    })
  })

  it('throws ConflictError and writes nothing when the lead is already converted', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      convertedCustomerId: 'cust-existing',
      contact,
    })

    await expect(convertLead(tx as any, ctx, input)).rejects.toThrow('already been converted')
    expect(tx.customer.create).not.toHaveBeenCalled()
    expect(nextSalesOrderNumber).not.toHaveBeenCalled()
  })

  it('throws NotFoundError when the lead does not exist', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue(null)
    await expect(convertLead(tx as any, ctx, input)).rejects.toThrow('Lead not found')
  })

  it('throws when an ordered product is not in the org (before any writes)', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      companyName: 'Acme',
      convertedCustomerId: null,
      contact,
    })
    tx.product.findMany.mockResolvedValue([]) // product missing / cross-tenant

    await expect(convertLead(tx as any, ctx, input)).rejects.toThrow(/Product/)
    expect(tx.customer.create).not.toHaveBeenCalled()
  })
})

import { enqueue, renderPayload } from '../tally-sync.service'

function makeTx() {
  return {
    tallySyncQueue: { upsert: jest.fn().mockResolvedValue({ id: 'q1' }) },
  }
}

describe('enqueue', () => {
  it('is idempotent: two enqueues of the same entity upsert the same unique key (never two rows)', async () => {
    const tx = makeTx()
    const args = { orgId: 'org', entityType: 'sales_order', entityId: 'so-1' }

    await enqueue(tx as any, args)
    await enqueue(tx as any, args)

    expect(tx.tallySyncQueue.upsert).toHaveBeenCalledTimes(2)
    const where1 = tx.tallySyncQueue.upsert.mock.calls[0][0].where
    const where2 = tx.tallySyncQueue.upsert.mock.calls[1][0].where
    expect(where1).toEqual(where2)
    expect(where1).toEqual({
      orgId_entityType_entityId_direction: {
        orgId: 'org',
        entityType: 'sales_order',
        entityId: 'so-1',
        direction: 'push',
      },
    })
    // re-enqueue resets a prior failure back to pending
    expect(tx.tallySyncQueue.upsert.mock.calls[0][0].update).toEqual({
      status: 'pending',
      lastError: null,
    })
  })
})

describe('renderPayload', () => {
  const entity = { id: 'so-1', soNumber: 'SO-2026-001', totalAmount: 236 }

  it('renders a Tally XML voucher envelope', () => {
    const xml = renderPayload('sales_order', entity, 'xml')
    expect(xml).toContain('<VOUCHER')
    expect(xml).toContain('VCHTYPE="Sales Order"')
    expect(xml).toContain('SO-2026-001')
  })

  it('renders the same envelope as JSON', () => {
    const json = renderPayload('sales_order', entity, 'json')
    const parsed = JSON.parse(json)
    expect(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE.VOUCHER.VOUCHERNUMBER
    ).toBe('SO-2026-001')
  })
})

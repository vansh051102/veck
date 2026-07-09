jest.mock('@/lib/db', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

import { nextQuoteNumber, nextPurchaseRequestNumber, nextSalesOrderNumber, nextInvoiceNumber } from '../numbering'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as { $queryRaw: jest.Mock }

describe('nextQuoteNumber', () => {
  beforeEach(() => {
    mockPrisma.$queryRaw.mockReset()
  })

  it('formats QT-2026-001 for the first quote', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 1 }])
    const num = await nextQuoteNumber('org-1', 2026)
    expect(num).toBe('QT-2026-001')
  })

  it('increments sequence for subsequent quotes', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 42 }])
    const num = await nextQuoteNumber('org-1', 2026)
    expect(num).toBe('QT-2026-042')
  })

  it('pads sequence with leading zeros', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 100 }])
    const num = await nextQuoteNumber('org-1', 2026)
    expect(num).toBe('QT-2026-100')
  })
})

describe('nextPurchaseRequestNumber', () => {
  it('formats PR-2026-001 for the first PR', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 1 }])
    const num = await nextPurchaseRequestNumber('org-1', 2026)
    expect(num).toBe('PR-2026-001')
  })
})

describe('nextSalesOrderNumber', () => {
  it('formats SO-2026-005', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 5 }])
    const num = await nextSalesOrderNumber(mockPrisma as any, 'org-1', 2026)
    expect(num).toBe('SO-2026-005')
  })
})

describe('nextInvoiceNumber', () => {
  it('formats INV-2026-012', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ value: 12 }])
    const num = await nextInvoiceNumber(mockPrisma as any, 'org-1', 2026)
    expect(num).toBe('INV-2026-012')
  })
})
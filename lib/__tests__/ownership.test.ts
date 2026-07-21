import { buildOwnershipFilter, canAccessLead } from '../ownership'
import { PURCHASE_QUERY_STAGES } from '../lead-stages'

// Reference the shared constant rather than a hand-copied list, so widening or
// narrowing purchase visibility can't silently drift away from these tests.
const PURCHASE_STAGES = [...PURCHASE_QUERY_STAGES]

jest.mock('@/lib/db', () => ({
  prisma: {
    lead: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))
import { prisma } from '@/lib/db'
const mockPrisma = prisma as unknown as {
  lead: { findUnique: jest.Mock }
  user: { findUnique: jest.Mock }
}

describe('buildOwnershipFilter', () => {
  const U = 'user-1'

  it('admin sees everything (empty filter)', () => {
    expect(buildOwnershipFilter(U, 'admin', null, 'leads')).toEqual({})
  })

  it('marketing_manager sees Marketing-owned plus unassigned leads', () => {
    expect(buildOwnershipFilter(U, 'marketing_manager', null, 'leads')).toEqual({
      OR: [{ assignedToId: null }, { assignedTo: { department: 'Marketing' } }],
    })
  })

  it('marketing_executive scopes leads to self and activities via lead', () => {
    expect(buildOwnershipFilter(U, 'marketing_executive', null, 'leads')).toEqual({ assignedToId: U })
    expect(buildOwnershipFilter(U, 'marketing_executive', null, 'activities')).toEqual({
      lead: { assignedToId: U },
    })
  })

  it('sales_manager sees Sales-owned plus unassigned leads', () => {
    expect(buildOwnershipFilter(U, 'sales_manager', null, 'leads')).toEqual({
      OR: [{ assignedToId: null }, { assignedTo: { department: 'Sales' } }],
    })
  })

  it('sales_executive scopes leads to self', () => {
    expect(buildOwnershipFilter(U, 'sales_executive', null, 'leads')).toEqual({ assignedToId: U })
  })

  it('purchase scopes to own leads in purchase-visible stages', () => {
    expect(buildOwnershipFilter(U, 'purchase', null, 'leads')).toEqual({
      assignedToId: U,
      stage: { in: PURCHASE_STAGES },
    })
    expect(buildOwnershipFilter(U, 'purchase', null, 'quotes')).toEqual({
      lead: { assignedToId: U, stage: { in: PURCHASE_STAGES } },
    })
  })

  it('purchase-visible stages cover quote handoff and post-order procurement', () => {
    expect(PURCHASE_STAGES).toEqual([
      'Qualified',
      'Quote Sent',
      'Order Confirmed',
      'Order Closed',
      'Closed Won',
    ])
  })

  it('sales_purchase scopes to own assignments across resources', () => {
    expect(buildOwnershipFilter(U, 'sales_purchase', null, 'leads')).toEqual({ assignedToId: U })
    expect(buildOwnershipFilter(U, 'sales_purchase', null, 'quotes')).toEqual({
      lead: { assignedToId: U },
    })
  })

  it('unknown role denies all', () => {
    expect(buildOwnershipFilter(U, 'nonexistent', null, 'leads')).toEqual({ id: '__DENY_ALL__' })
  })
})

describe('canAccessLead', () => {
  beforeEach(() => {
    mockPrisma.lead.findUnique.mockReset()
    mockPrisma.user.findUnique.mockReset()
  })

  it('admin always has access without a DB lookup', async () => {
    expect(await canAccessLead('u', 'admin', 'lead-1')).toBe(true)
    expect(mockPrisma.lead.findUnique).not.toHaveBeenCalled()
  })

  it('returns false when the lead does not exist', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null)
    expect(await canAccessLead('u', 'sales_executive', 'missing')).toBe(false)
  })

  it('sales_executive can access only their own lead', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'u', stage: 'New Lead' })
    expect(await canAccessLead('u', 'sales_executive', 'l')).toBe(true)
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'other', stage: 'New Lead' })
    expect(await canAccessLead('u', 'sales_executive', 'l')).toBe(false)
  })

  it('marketing_manager access depends on assignee department', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'a', stage: 'New Lead' })
    mockPrisma.user.findUnique.mockResolvedValue({ department: 'Marketing' })
    expect(await canAccessLead('u', 'marketing_manager', 'l')).toBe(true)
    mockPrisma.user.findUnique.mockResolvedValue({ department: 'Sales' })
    expect(await canAccessLead('u', 'marketing_manager', 'l')).toBe(false)
  })

  it('purchase needs ownership AND a Qualified/Quote Sent stage', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'u', stage: 'Quote Sent' })
    expect(await canAccessLead('u', 'purchase', 'l')).toBe(true)
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'u', stage: 'New Lead' })
    expect(await canAccessLead('u', 'purchase', 'l')).toBe(false)
  })

  it('unknown role is denied', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ createdById: 'x', assignedToId: 'u', stage: 'New Lead' })
    expect(await canAccessLead('u', 'ghost', 'l')).toBe(false)
  })
})

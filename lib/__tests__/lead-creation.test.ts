jest.mock('@/lib/db', () => ({ prisma: { $transaction: jest.fn() } }))
jest.mock('@/lib/sop-checklists', () => ({ createSopChecklistsForStage: jest.fn() }))
jest.mock('@/lib/auto-assign', () => ({ pickAssignee: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/sla-engine', () => ({
  startSlaClock: jest.fn().mockResolvedValue({
    clockId: 'clock-1',
    deadline: new Date('2026-01-02T00:00:00Z'),
    targetMinutes: 60,
  }),
}))

import { createLeadWithDefaults } from '../lead-creation'
import { prisma } from '@/lib/db'
import { createSopChecklistsForStage } from '@/lib/sop-checklists'
import { pickAssignee } from '@/lib/auto-assign'

const $transaction = (prisma as unknown as { $transaction: jest.Mock }).$transaction

function makeTx() {
  return {
    lead: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    timeline: { create: jest.fn().mockResolvedValue({}) },
    settings: { findUnique: jest.fn().mockResolvedValue(null) },
  }
}

const baseInput = {
  orgId: 'org',
  contactId: 'contact-1',
  companyName: 'Acme',
  createdById: 'user-1',
  externalId: 'ext-123',
}

describe('createLeadWithDefaults', () => {
  beforeEach(() => {
    ;(createSopChecklistsForStage as jest.Mock).mockReset()
    ;(pickAssignee as jest.Mock).mockReset().mockResolvedValue(null)
    $transaction.mockReset()
  })

  it('returns the existing lead (duplicate) when an open lead for the contact exists', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue({ id: 'existing', companyName: 'Acme', stage: 'New Lead', assignedTo: null })
    $transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx))

    const result = await createLeadWithDefaults(baseInput)

    expect(result).toEqual({
      duplicate: true,
      existingLead: { id: 'existing', companyName: 'Acme', stage: 'New Lead', assignedTo: null },
    })
    expect(tx.lead.create).not.toHaveBeenCalled()
  })

  it('creates a New Lead with SLA deadline, externalId, and stage checklist', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue(null)
    tx.lead.create.mockResolvedValue({ id: 'new-lead' })
    $transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx))

    const result = await createLeadWithDefaults(baseInput)

    expect(result).toEqual({ duplicate: false, lead: { id: 'new-lead' } })
    const createArg = tx.lead.create.mock.calls[0][0].data
    expect(createArg.stage).toBe('New Lead')
    expect(createArg.externalId).toBe('ext-123')
    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: 'new-lead' },
      data: { slaDeadline: new Date('2026-01-02T00:00:00Z') },
    })
    expect(createSopChecklistsForStage).toHaveBeenCalledWith(tx, 'new-lead', 'New Lead', undefined)
    expect(pickAssignee).toHaveBeenCalled()
  })

  it('honors an explicit assignee and skips auto-assignment', async () => {
    const tx = makeTx()
    tx.lead.findFirst.mockResolvedValue(null)
    tx.lead.create.mockResolvedValue({ id: 'new-lead' })
    $transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx))

    await createLeadWithDefaults({ ...baseInput, assignedToId: 'rep-9' })

    expect(pickAssignee).not.toHaveBeenCalled()
    expect(tx.lead.create.mock.calls[0][0].data.assignedToId).toBe('rep-9')
  })
})

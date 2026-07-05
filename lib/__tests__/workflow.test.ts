import {
  isValidTransition,
  isTerminalStage,
  calculateSlaDeadline,
  isSlaBreached,
  assertTransitionAllowed,
  TERMINAL_STAGES,
} from '../workflow'
import { ValidationError, ConflictError } from '../api-response'
import type { Lead } from '@prisma/client'

// Mock the Prisma client so gating logic can be tested without a real DB.
jest.mock('../db', () => ({
  prisma: {
    activity: { count: jest.fn() },
    checklist: { count: jest.fn() },
  },
}))

import { prisma } from '../db'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date()
  return {
    id: 'lead-1',
    orgId: 'org-1',
    contactId: 'contact-1',
    companyName: 'Acme Steel',
    stage: 'New Lead',
    stageChangedAt: now,
    stageChangedBy: null,
    priority: 'Medium',
    status: 'open',
    dealLostReason: null,
    dealLostDate: null,
    assignedToId: null,
    assignedAt: null,
    source: null,
    sourceDetails: null,
    notes: null,
    customFields: null,
    tags: [],
    slaCreatedAt: now,
    slaDeadline: now,
    slaBreached: false,
    firstResponseAt: null,
    viewCount: 0,
    lastViewedAt: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    createdById: 'user-1',
    ...overrides,
  } as Lead
}

describe('isValidTransition', () => {
  it('allows New Lead -> Contacted', () => {
    expect(isValidTransition('New Lead', 'Contacted')).toBe(true)
  })

  it('rejects skipping stages (New Lead -> Quote Sent)', () => {
    expect(isValidTransition('New Lead', 'Quote Sent')).toBe(false)
  })

  it('rejects a stage transitioning to itself', () => {
    expect(isValidTransition('Contacted', 'Contacted')).toBe(false)
  })

  it('allows any active stage to move to Deal Lost or Disqualified', () => {
    expect(isValidTransition('Contacted', 'Deal Lost')).toBe(true)
    expect(isValidTransition('Qualified', 'Disqualified')).toBe(true)
  })

  it('rejects transitions out of terminal stages', () => {
    for (const stage of TERMINAL_STAGES) {
      expect(isValidTransition(stage, 'Contacted')).toBe(false)
    }
  })

  it('throws for an unknown source stage', () => {
    expect(() => isValidTransition('Not A Stage', 'Contacted')).toThrow(ValidationError)
  })
})

describe('isTerminalStage', () => {
  it('identifies terminal stages correctly', () => {
    expect(isTerminalStage('Closed Won')).toBe(true)
    expect(isTerminalStage('Deal Lost')).toBe(true)
    expect(isTerminalStage('Disqualified')).toBe(true)
    expect(isTerminalStage('Contacted')).toBe(false)
  })
})

describe('calculateSlaDeadline', () => {
  const from = new Date('2026-01-01T00:00:00Z')

  it('gives New Lead a 1 hour window', () => {
    const deadline = calculateSlaDeadline('New Lead', from)
    expect(deadline.getTime() - from.getTime()).toBe(60 * 60 * 1000)
  })

  it('gives Contacted a 24 hour window', () => {
    const deadline = calculateSlaDeadline('Contacted', from)
    expect(deadline.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('gives Qualified a 3 hour window', () => {
    const deadline = calculateSlaDeadline('Qualified', from)
    expect(deadline.getTime() - from.getTime()).toBe(3 * 60 * 60 * 1000)
  })

  it('gives Quote Sent a 6 day window', () => {
    const deadline = calculateSlaDeadline('Quote Sent', from)
    expect(deadline.getTime() - from.getTime()).toBe(6 * 24 * 60 * 60 * 1000)
  })

  it('gives terminal stages a far-future deadline (never breaches)', () => {
    const deadline = calculateSlaDeadline('Closed Won', from)
    expect(deadline.getTime()).toBeGreaterThan(from.getTime() + 300 * 24 * 60 * 60 * 1000)
  })
})

describe('isSlaBreached', () => {
  it('is false before the deadline', () => {
    const deadline = new Date('2026-01-02T00:00:00Z')
    const now = new Date('2026-01-01T00:00:00Z')
    expect(isSlaBreached(deadline, now)).toBe(false)
  })

  it('is true after the deadline', () => {
    const deadline = new Date('2026-01-01T00:00:00Z')
    const now = new Date('2026-01-02T00:00:00Z')
    expect(isSlaBreached(deadline, now)).toBe(true)
  })
})

describe('assertTransitionAllowed', () => {
  const mockedPrisma = prisma as unknown as {
    activity: { count: jest.Mock }
    checklist: { count: jest.Mock }
  }

  beforeEach(() => {
    mockedPrisma.activity.count.mockReset()
    mockedPrisma.checklist.count.mockReset()
  })

  it('rejects structurally invalid transitions before checking gates', async () => {
    const lead = makeLead({ stage: 'New Lead' })
    await expect(assertTransitionAllowed(lead, 'Quote Sent')).rejects.toThrow(ConflictError)
    expect(mockedPrisma.activity.count).not.toHaveBeenCalled()
  })

  it('blocks New Lead -> Contacted with zero logged activities', async () => {
    mockedPrisma.activity.count.mockResolvedValue(0)
    const lead = makeLead({ stage: 'New Lead' })
    await expect(assertTransitionAllowed(lead, 'Contacted')).rejects.toThrow(ConflictError)
  })

  it('allows New Lead -> Contacted once an activity is logged and no required checklists are open', async () => {
    mockedPrisma.activity.count.mockResolvedValue(1)
    mockedPrisma.checklist.count.mockResolvedValue(0)
    const lead = makeLead({ stage: 'New Lead' })
    await expect(assertTransitionAllowed(lead, 'Contacted')).resolves.toBeUndefined()
  })

  it('blocks Contacted -> Qualified when a required checklist is incomplete', async () => {
    mockedPrisma.activity.count.mockResolvedValue(5)
    mockedPrisma.checklist.count.mockResolvedValue(1)
    const lead = makeLead({ stage: 'Contacted' })
    await expect(assertTransitionAllowed(lead, 'Qualified')).rejects.toThrow(ConflictError)
  })

  it('blocks Contacted -> Qualified with fewer than 3 activities', async () => {
    mockedPrisma.activity.count.mockResolvedValue(2)
    mockedPrisma.checklist.count.mockResolvedValue(0)
    const lead = makeLead({ stage: 'Contacted' })
    await expect(assertTransitionAllowed(lead, 'Qualified')).rejects.toThrow(ConflictError)
  })

  it('requires a reason when moving to Disqualified', async () => {
    const lead = makeLead({ stage: 'Qualified' })
    await expect(assertTransitionAllowed(lead, 'Disqualified')).rejects.toThrow(ValidationError)
  })

  it('allows moving to Disqualified with a valid SOP reason, skipping other gates', async () => {
    const lead = makeLead({ stage: 'Qualified' })
    await expect(
      assertTransitionAllowed(lead, 'Disqualified', 'Budget Issue')
    ).resolves.toBeUndefined()
    expect(mockedPrisma.activity.count).not.toHaveBeenCalled()
    expect(mockedPrisma.checklist.count).not.toHaveBeenCalled()
  })

  it('rejects free-text loss reasons not in the SOP list', async () => {
    const lead = makeLead({ stage: 'Qualified' })
    await expect(
      assertTransitionAllowed(lead, 'Disqualified', 'Budget cut')
    ).rejects.toThrow(ValidationError)
  })
})

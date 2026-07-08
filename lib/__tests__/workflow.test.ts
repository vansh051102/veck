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

  it('allows skipping stages (New Lead -> Quote Sent) — movement is unrestricted', () => {
    expect(isValidTransition('New Lead', 'Quote Sent')).toBe(true)
  })

  it('rejects a stage transitioning to itself', () => {
    expect(isValidTransition('Contacted', 'Contacted')).toBe(false)
  })

  it('allows any active stage to move to Deal Lost or Disqualified', () => {
    expect(isValidTransition('Contacted', 'Deal Lost')).toBe(true)
    expect(isValidTransition('Qualified', 'Disqualified')).toBe(true)
  })

  it('allows reopening a terminal stage back to an active one', () => {
    for (const stage of TERMINAL_STAGES) {
      expect(isValidTransition(stage, 'Contacted')).toBe(true)
    }
  })

  it('throws for an unknown source or target stage', () => {
    expect(() => isValidTransition('Not A Stage', 'Contacted')).toThrow(ValidationError)
    expect(() => isValidTransition('Contacted', 'Not A Stage')).toThrow(ValidationError)
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
  it('rejects moving a lead to its current stage', () => {
    const lead = makeLead({ stage: 'New Lead' })
    expect(() => assertTransitionAllowed(lead, 'New Lead')).toThrow(ConflictError)
  })

  it('allows New Lead -> Contacted with zero logged activities (no activity gate)', () => {
    const lead = makeLead({ stage: 'New Lead' })
    expect(() => assertTransitionAllowed(lead, 'Contacted')).not.toThrow()
  })

  it('allows skipping stages freely (New Lead -> Quote Sent)', () => {
    const lead = makeLead({ stage: 'New Lead' })
    expect(() => assertTransitionAllowed(lead, 'Quote Sent')).not.toThrow()
  })

  it('allows reopening a terminal lead back to an active stage', () => {
    const lead = makeLead({ stage: 'Closed Won' })
    expect(() => assertTransitionAllowed(lead, 'Contacted')).not.toThrow()
  })

  it('requires a reason when moving to Disqualified', () => {
    const lead = makeLead({ stage: 'Qualified' })
    expect(() => assertTransitionAllowed(lead, 'Disqualified')).toThrow(ValidationError)
  })

  it('allows moving to Disqualified with a valid SOP reason', () => {
    const lead = makeLead({ stage: 'Qualified' })
    expect(() =>
      assertTransitionAllowed(lead, 'Disqualified', 'Customer Not Interested')
    ).not.toThrow()
  })

  it('allows moving to Deal Lost with a valid SOP reason', () => {
    const lead = makeLead({ stage: 'Quote Sent' })
    expect(() => assertTransitionAllowed(lead, 'Deal Lost', 'Price Not Accepted')).not.toThrow()
  })

  it('rejects a Deal Lost reason on the Disqualified path (lists are distinct)', () => {
    const lead = makeLead({ stage: 'Qualified' })
    // "Budget Constraints" is a Deal Lost reason, not a Disqualified one.
    expect(() => assertTransitionAllowed(lead, 'Disqualified', 'Budget Constraints')).toThrow(
      ValidationError
    )
  })

  it('rejects free-text loss reasons not in the SOP list', () => {
    const lead = makeLead({ stage: 'Qualified' })
    expect(() => assertTransitionAllowed(lead, 'Disqualified', 'Budget cut')).toThrow(
      ValidationError
    )
  })
})

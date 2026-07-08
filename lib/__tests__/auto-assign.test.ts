import { pickAssignee } from '../auto-assign'

// pickAssignee takes the transaction client as an argument, so we inject a mock
// directly — no module mocking of prisma needed.
function makeTx(overrides: Record<string, any> = {}) {
  const base = {
    assignmentRule: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    settings: { findUnique: jest.fn().mockResolvedValue(null) },
    lead: { findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn().mockResolvedValue([]) },
  }
  return { ...base, ...overrides } as any
}

describe('pickAssignee — assignment rules (layer 1)', () => {
  it('routes to the first matching active-rule assignee', async () => {
    const tx = makeTx({
      assignmentRule: {
        findMany: jest.fn().mockResolvedValue([
          { weekday: null, productCategory: null, assignedToId: 'u1' },
        ]),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }), findMany: jest.fn() },
    })
    expect(await pickAssignee(tx, 'org', { source: 'IndiaMART' })).toBe('u1')
    // Settings fallback should not run when a rule matches.
    expect(tx.settings.findUnique).not.toHaveBeenCalled()
  })

  it('skips a rule whose assignee is inactive, then falls through', async () => {
    const tx = makeTx({
      assignmentRule: {
        findMany: jest.fn().mockResolvedValue([
          { weekday: null, productCategory: null, assignedToId: 'inactive' },
        ]),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      settings: { findUnique: jest.fn().mockResolvedValue({ autoAssignmentEnabled: false }) },
    })
    expect(await pickAssignee(tx, 'org', { source: 'IndiaMART' })).toBeNull()
  })
})

describe('pickAssignee — settings fallback (layer 2)', () => {
  it('returns null when auto-assignment is off', async () => {
    const tx = makeTx({
      settings: { findUnique: jest.fn().mockResolvedValue({ autoAssignmentEnabled: false }) },
    })
    expect(await pickAssignee(tx, 'org', {})).toBeNull()
  })

  it('returns null when there are no active users', async () => {
    const tx = makeTx({
      settings: { findUnique: jest.fn().mockResolvedValue({ autoAssignmentEnabled: true }) },
      user: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    })
    expect(await pickAssignee(tx, 'org', {})).toBeNull()
  })

  it('round_robin picks the user after the last-assigned one', async () => {
    const tx = makeTx({
      settings: {
        findUnique: jest.fn().mockResolvedValue({
          autoAssignmentEnabled: true,
          autoAssignmentRule: { rule_type: 'round_robin' },
        }),
      },
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
      },
      lead: { findFirst: jest.fn().mockResolvedValue({ assignedToId: 'a' }), groupBy: jest.fn() },
    })
    expect(await pickAssignee(tx, 'org', {})).toBe('b')
  })

  it('round_robin wraps around and starts at index 0 with no prior lead', async () => {
    const users = { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]) }
    const settings = { findUnique: jest.fn().mockResolvedValue({ autoAssignmentEnabled: true, autoAssignmentRule: { rule_type: 'round_robin' } }) }

    const wrap = makeTx({ settings, user: users, lead: { findFirst: jest.fn().mockResolvedValue({ assignedToId: 'c' }), groupBy: jest.fn() } })
    expect(await pickAssignee(wrap, 'org', {})).toBe('a')

    const none = makeTx({ settings, user: users, lead: { findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn() } })
    expect(await pickAssignee(none, 'org', {})).toBe('a')
  })

  it('least_open_leads picks the user with the fewest open leads', async () => {
    const tx = makeTx({
      settings: { findUnique: jest.fn().mockResolvedValue({ autoAssignmentEnabled: true, autoAssignmentRule: null }) },
      user: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]) },
      lead: {
        findFirst: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          { assignedToId: 'a', _count: { _all: 3 } },
          { assignedToId: 'b', _count: { _all: 1 } },
          // c has 0 (absent from groupBy) → should win
        ]),
      },
    })
    expect(await pickAssignee(tx, 'org', {})).toBe('c')
  })
})

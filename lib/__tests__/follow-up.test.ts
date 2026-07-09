import { createFollowUpSchedule, FOLLOW_UP_DAYS, FOLLOW_UP_TITLE_PREFIX } from '../follow-up'

function mockTx(overrides: Partial<{
  activity: { count: jest.Mock; create: jest.Mock }
}> = {}): any {
  return {
    activity: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
      ...overrides.activity,
    },
  }
}

describe('createFollowUpSchedule', () => {
  it('creates FOLLOW_UP_DAYS activities when none exist', async () => {
    const tx = mockTx()
    const result = await createFollowUpSchedule(tx, {
      leadId: 'lead-1',
      orgId: 'org-1',
      createdBy: 'user-1',
    })
    expect(result).toBe(FOLLOW_UP_DAYS)
    expect(tx.activity.count).toHaveBeenCalledWith({
      where: {
        leadId: 'lead-1',
        type: 'task',
        status: 'pending',
        title: { startsWith: FOLLOW_UP_TITLE_PREFIX },
      },
    })
    expect(tx.activity.create).toHaveBeenCalledTimes(FOLLOW_UP_DAYS)
  })

  it('uses correct title prefix for each day', async () => {
    const tx = mockTx()
    await createFollowUpSchedule(tx, {
      leadId: 'lead-1',
      orgId: 'org-1',
      createdBy: 'user-1',
    })
    for (let day = 1; day <= FOLLOW_UP_DAYS; day++) {
      expect(tx.activity.create).toHaveBeenNthCalledWith(day, expect.objectContaining({
        data: expect.objectContaining({
          title: `${FOLLOW_UP_TITLE_PREFIX} (day ${day} of ${FOLLOW_UP_DAYS})`,
        }),
      }))
    }
  })

  it('sets scheduledFor dates incrementing by 1 day', async () => {
    const tx = mockTx()
    const from = new Date('2026-01-01T00:00:00Z')
    await createFollowUpSchedule(tx, {
      leadId: 'lead-1',
      orgId: 'org-1',
      createdBy: 'user-1',
      from,
    })

    for (let day = 1; day <= FOLLOW_UP_DAYS; day++) {
      const expected = new Date(from.getTime() + day * 24 * 60 * 60 * 1000)
      expect(tx.activity.create).toHaveBeenNthCalledWith(day, expect.objectContaining({
        data: expect.objectContaining({ scheduledFor: expected }),
      }))
    }
  })

  it('includes sop metadata on each activity', async () => {
    const tx = mockTx()
    await createFollowUpSchedule(tx, {
      leadId: 'lead-1',
      orgId: 'org-1',
      createdBy: 'user-1',
    })
    expect(tx.activity.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ metadata: { sop: 'QUOTE_SENT_FOLLOW_UP', day: 1 } }),
    }))
  })

  it('returns 0 and does NOT create activities if pending tasks already exist', async () => {
    const tx = mockTx({ activity: { count: jest.fn().mockResolvedValue(3), create: jest.fn() } })
    const result = await createFollowUpSchedule(tx, {
      leadId: 'lead-1',
      orgId: 'org-1',
      createdBy: 'user-1',
    })
    expect(result).toBe(0)
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})
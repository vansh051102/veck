import { SOP_CHECKLISTS_BY_STAGE } from '../sop-checklists'
import { DEAL_LOST_REASONS, isValidDealLostReason } from '../lead-stages'

describe('SOP checklist templates', () => {
  it('defines templates for every active stage', () => {
    expect(Object.keys(SOP_CHECKLISTS_BY_STAGE)).toEqual([
      'New Lead',
      'Contacted',
      'Qualified',
      'Quote Sent',
    ])
  })

  it('matches SOP item counts (4+4 / 22+5 / 17 / 10)', () => {
    const counts = Object.fromEntries(
      Object.entries(SOP_CHECKLISTS_BY_STAGE).map(([stage, templates]) => [
        stage,
        templates.map((t) => t.items.length),
      ])
    )
    expect(counts).toEqual({
      'New Lead': [4, 4],
      Contacted: [22, 5],
      Qualified: [17],
      'Quote Sent': [10],
    })
  })

  it('gating stages have required checklists; Quote Sent does not block the loss path', () => {
    expect(SOP_CHECKLISTS_BY_STAGE['New Lead'].some((t) => t.isRequired)).toBe(true)
    expect(SOP_CHECKLISTS_BY_STAGE['Contacted'].every((t) => t.isRequired)).toBe(true)
    expect(SOP_CHECKLISTS_BY_STAGE['Qualified'].every((t) => t.isRequired)).toBe(true)
    expect(SOP_CHECKLISTS_BY_STAGE['Quote Sent'].every((t) => !t.isRequired)).toBe(true)
  })

  it('has no duplicate item titles within a checklist', () => {
    for (const templates of Object.values(SOP_CHECKLISTS_BY_STAGE)) {
      for (const t of templates) {
        expect(new Set(t.items).size).toBe(t.items.length)
      }
    }
  })
})

describe('deal-lost reasons', () => {
  it('accepts every SOP reason', () => {
    for (const reason of DEAL_LOST_REASONS) {
      expect(isValidDealLostReason(reason)).toBe(true)
    }
  })

  it('rejects free text', () => {
    expect(isValidDealLostReason('customer was rude')).toBe(false)
    expect(isValidDealLostReason('')).toBe(false)
  })
})

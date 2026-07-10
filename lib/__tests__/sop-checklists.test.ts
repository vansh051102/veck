import {
  SOP_CHECKLISTS_BY_STAGE,
  SALES_SOP_CHECKLISTS,
  MARKETING_SOP_CHECKLISTS,
  PURCHASE_SOP_CHECKLISTS,
  getSopChecklistsForStage,
  sopTrackForRole,
} from '../sop-checklists'
import { DEAL_LOST_REASONS, isValidDealLostReason } from '../lead-stages'

describe('SOP checklist templates', () => {
  it('default map is the sales SOP', () => {
    expect(SOP_CHECKLISTS_BY_STAGE).toBe(SALES_SOP_CHECKLISTS)
  })

  it('sales defines New Lead through Order Confirmed', () => {
    expect(Object.keys(SALES_SOP_CHECKLISTS)).toEqual(
      expect.arrayContaining([
        'New Lead',
        'Contacted',
        'Qualified',
        'Quote Sent',
        'Order Confirmed',
      ])
    )
  })

  it('marketing has lighter New Lead / Contacted / Qualified sets', () => {
    expect(MARKETING_SOP_CHECKLISTS['New Lead'][0].items).toHaveLength(6)
    expect(MARKETING_SOP_CHECKLISTS.Contacted[0].items.length).toBeGreaterThanOrEqual(10)
    expect(MARKETING_SOP_CHECKLISTS.Qualified[0].title).toMatch(/Handover/)
  })

  it('purchase has Order Confirmed procurement checklists', () => {
    expect(PURCHASE_SOP_CHECKLISTS['Order Confirmed'].length).toBeGreaterThanOrEqual(3)
    expect(PURCHASE_SOP_CHECKLISTS['Order Confirmed'][0].items).toEqual(
      expect.arrayContaining(['3 Vendor Comparison Completed', 'PO Generated Same Day'])
    )
  })

  it('selects track by role', () => {
    expect(sopTrackForRole('marketing_executive')).toBe('marketing')
    expect(sopTrackForRole('purchase')).toBe('purchase')
    expect(sopTrackForRole('sales_executive')).toBe('sales')
    expect(getSopChecklistsForStage('New Lead', 'marketing_manager')[0].title).toBe(
      'New Lead Checklist'
    )
    expect(getSopChecklistsForStage('New Lead', 'sales_executive')[0].title).toBe(
      'New Lead Registration Checklist'
    )
  })

  it('gating stages have required checklists; Quote Sent does not block the loss path', () => {
    expect(SALES_SOP_CHECKLISTS['New Lead'].some((t) => t.isRequired)).toBe(true)
    expect(SALES_SOP_CHECKLISTS['Contacted'].every((t) => t.isRequired)).toBe(true)
    expect(SALES_SOP_CHECKLISTS['Qualified'].every((t) => t.isRequired)).toBe(true)
    expect(SALES_SOP_CHECKLISTS['Quote Sent'].every((t) => !t.isRequired)).toBe(true)
  })

  it('has no duplicate item titles within a checklist', () => {
    for (const templates of [
      ...Object.values(SALES_SOP_CHECKLISTS),
      ...Object.values(MARKETING_SOP_CHECKLISTS),
      ...Object.values(PURCHASE_SOP_CHECKLISTS),
    ]) {
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

import { ALLOWED_TRANSITIONS, isFlaggedDisqualify, nextValidStages } from '@/lib/lead-stages'

describe('SOP transition sequence (pure, dependency-free layer)', () => {
  test('happy path is allowed', () => {
    expect(nextValidStages('New Lead')).toEqual(['Contacted', 'Disqualified'])
    expect(nextValidStages('Contacted')).toEqual(['Qualified', 'Disqualified'])
    expect(nextValidStages('Qualified')).toEqual(['Quote Sent', 'Disqualified'])
    expect(nextValidStages('Quote Sent')).toEqual(['Qualified', 'Order Confirmed', 'Deal Lost', 'Disqualified'])
    expect(nextValidStages('Order Confirmed')).toEqual(['Order Closed', 'Deal Lost'])
  })

  test('Deal Lost only exists past Quote Sent', () => {
    expect(ALLOWED_TRANSITIONS['Qualified']).not.toContain('Deal Lost')
    expect(ALLOWED_TRANSITIONS['Quote Sent']).toContain('Deal Lost')
  })

  test('illegal skips are not in the map', () => {
    expect(nextValidStages('New Lead')).not.toContain('Order Confirmed')
    expect(nextValidStages('New Lead')).not.toContain('Quote Sent')
    expect(nextValidStages('Quote Sent')).not.toContain('New Lead')
  })

  test('reopen paths preserved', () => {
    expect(nextValidStages('Order Closed')).toEqual(['Order Confirmed'])
    expect(nextValidStages('Deal Lost')).toEqual(['New Lead'])
    expect(nextValidStages('Disqualified')).toEqual(['New Lead'])
  })

  test('flagged disqualifications', () => {
    expect(isFlaggedDisqualify('New Lead', 'Disqualified')).toBe(false)
    expect(isFlaggedDisqualify('Contacted', 'Disqualified')).toBe(false)
    expect(isFlaggedDisqualify('Qualified', 'Disqualified')).toBe(true)
    expect(isFlaggedDisqualify('Quote Sent', 'Disqualified')).toBe(true)
    expect(isFlaggedDisqualify('Quote Sent', 'Deal Lost')).toBe(false)
  })
})

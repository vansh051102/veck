import { normalizeEmail, normalizePhone } from '../normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John.Doe@Example.COM ')).toBe('john.doe@example.com')
  })
  it('handles null/undefined', () => {
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
  })
})

describe('normalizePhone', () => {
  it('strips spaces, dashes, parens', () => {
    expect(normalizePhone(' (022) 4567-8900 ')).toBe('02245678900')
  })
  it('keeps a single leading plus', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210')
  })
  it('two formats of the same number collapse equal', () => {
    expect(normalizePhone('+91-98765-43210')).toBe(normalizePhone('+91 98765 43210'))
  })
  it('handles empty', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone(null)).toBe('')
  })
})

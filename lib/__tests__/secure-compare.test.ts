import { secureEqual } from '../secure-compare'

describe('secureEqual', () => {
  it('returns true for identical strings', () => {
    expect(secureEqual('Bearer s3cret', 'Bearer s3cret')).toBe(true)
  })

  it('returns false for different same-length strings', () => {
    expect(secureEqual('Bearer aaaaaa', 'Bearer bbbbbb')).toBe(false)
  })

  it('returns false for different-length strings without throwing', () => {
    expect(secureEqual('short', 'a much longer secret')).toBe(false)
  })

  it('returns false when one side is empty', () => {
    expect(secureEqual('', 'nonempty')).toBe(false)
    expect(secureEqual('nonempty', '')).toBe(false)
  })
})

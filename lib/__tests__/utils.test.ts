import {
  cn,
  formatDate,
  formatDateTime,
  getDaysUntil,
  getHoursUntil,
  isSlaOverdue,
  slugify,
  capitalize,
  truncate,
  generateId,
  formatCurrency,
  formatPercentage,
  roundToDecimals,
  isValidEmail,
  isValidPhone,
  isValidGSTNumber,
  chunk,
  groupBy,
  unique,
  pick,
  omit,
  isEmpty,
  buildQueryString,
  parseQueryString,
  debounce,
  throttle,
} from '../utils'

describe('cn', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2')
  })
})

describe('formatDate', () => {
  it('formats a date as DD/MM/YYYY by default', () => {
    const d = new Date(2026, 0, 5)
    expect(formatDate(d)).toBe('05/01/2026')
  })

  it('accepts a string date input', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
  })

  it('respects a custom format', () => {
    const d = new Date(2026, 0, 5)
    expect(formatDate(d, 'YYYY-MM-DD')).toBe('2026-01-05')
  })
})

describe('formatDateTime', () => {
  it('returns a formatted datetime string (en-IN locale)', () => {
    const d = new Date(2026, 5, 15, 14, 30)
    const result = formatDateTime(d)
    expect(result).toContain('2026')
    expect(result).toContain('15/06/2026')
  })
})

describe('getDaysUntil', () => {
  it('returns 0 for past dates', () => {
    expect(getDaysUntil(new Date('2020-01-01'))).toBe(0)
  })
})

describe('getHoursUntil', () => {
  it('returns 0 for past dates', () => {
    expect(getHoursUntil(new Date('2020-01-01'))).toBe(0)
  })
})

describe('isSlaOverdue', () => {
  it('returns true for past deadlines', () => {
    expect(isSlaOverdue(new Date('2020-01-01'))).toBe(true)
  })
})

describe('slugify', () => {
  it('converts text to kebab-case', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
  })

  it('handles special characters', () => {
    expect(slugify('Steel & Co. (Mumbai)')).toBe('steel-co-mumbai')
  })
})

describe('capitalize', () => {
  it('capitalizes first letter and lowercases the rest', () => {
    expect(capitalize('hELLO')).toBe('Hello')
  })
})

describe('truncate', () => {
  it('returns the full string when under maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('truncates and appends ellipsis', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...')
  })
})

describe('generateId', () => {
  it('generates a string with prefix', () => {
    const id = generateId('lead')
    expect(id).toMatch(/^lead-[a-z0-9-]+$/)
  })
})

describe('formatCurrency', () => {
  it('formats INR currency', () => {
    expect(formatCurrency(1500)).toContain('1,')
    expect(formatCurrency(1500)).toContain('500')
  })

  it('accepts custom currency', () => {
    expect(formatCurrency(10, 'USD')).toContain('10')
  })
})

describe('formatPercentage', () => {
  it('converts decimal to percentage', () => {
    expect(formatPercentage(0.256)).toBe('25.60%')
  })
})

describe('roundToDecimals', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundToDecimals(12.345)).toBe(12.35)
  })
})

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('not-email')).toBe(false)
  })
})

describe('isValidPhone', () => {
  it('accepts a valid Indian phone number', () => {
    expect(isValidPhone('+91-9876543210')).toBe(true)
  })

  it('rejects a short number', () => {
    expect(isValidPhone('123')).toBe(false)
  })
})

describe('isValidGSTNumber', () => {
  it('accepts a valid GST format', () => {
    expect(isValidGSTNumber('27AABCD1234E1Z1')).toBe(true)
  })

  it('rejects invalid format', () => {
    expect(isValidGSTNumber('invalid')).toBe(false)
  })
})

describe('chunk', () => {
  it('splits array into chunks of given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('groupBy', () => {
  it('groups items by a key', () => {
    const items = [{ type: 'a' }, { type: 'b' }, { type: 'a' }]
    const grouped = groupBy(items, 'type')
    expect(grouped).toEqual({ a: [{ type: 'a' }, { type: 'a' }], b: [{ type: 'b' }] })
  })
})

describe('unique', () => {
  it('deduplicates primitive arrays', () => {
    expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3])
  })

  it('deduplicates object arrays by key', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 1 }]
    expect(unique(items, 'id')).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('pick', () => {
  it('selects specified keys from an object', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, 'a', 'c')).toEqual({ a: 1, c: 3 })
  })
})

describe('omit', () => {
  it('omits specified keys from an object', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, 'b')).toEqual({ a: 1, c: 3 })
  })
})

describe('isEmpty', () => {
  it('returns true for empty arrays', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('returns false for non-empty arrays', () => {
    expect(isEmpty([1])).toBe(false)
  })

  it('returns true for empty objects', () => {
    expect(isEmpty({})).toBe(true)
  })

  it('returns true for null/undefined', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
  })
})

describe('buildQueryString', () => {
  it('builds a query string from params', () => {
    expect(buildQueryString({ page: '1', q: 'test' })).toBe('page=1&q=test')
  })

  it('skips null and undefined values', () => {
    expect(buildQueryString({ a: '1', b: null, c: undefined, d: '' })).toBe('a=1')
  })
})

describe('parseQueryString', () => {
  it('parses a query string into params', () => {
    expect(parseQueryString('page=2&q=hello')).toEqual({ page: '2', q: 'hello' })
  })
})

describe('debounce', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('defers execution until after the delay', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('calls immediately and then blocks within the limit', () => {
    const fn = jest.fn()
    const throttled = throttle(fn, 100)
    throttled()
    throttled()
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(100)
    throttled()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
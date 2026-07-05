import { toCsv, parseCsv, parseCsvWithHeader } from '../csv'

describe('toCsv', () => {
  it('serializes rows with escaping', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has,comma'], ['has "quote"', 'line\nbreak']])
    expect(csv).toBe('a,b\r\nplain,"has,comma"\r\n"has ""quote""","line\nbreak"')
  })

  it('renders null/undefined as empty', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,')
  })
})

describe('parseCsv', () => {
  it('round-trips with toCsv', () => {
    const rows = [['x', 'y,z'], ['"q"', 'multi\nline']]
    expect(parseCsv(toCsv(['h1', 'h2'], rows))).toEqual([['h1', 'h2'], ...rows])
  })

  it('handles CRLF and skips empty trailing lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseCsvWithHeader', () => {
  it('maps rows to lowercased header keys', () => {
    const objs = parseCsvWithHeader('Company,Email\r\nAcme,x@y.com')
    expect(objs).toEqual([{ company: 'Acme', email: 'x@y.com' }])
  })

  it('returns [] without data rows', () => {
    expect(parseCsvWithHeader('Company,Email')).toEqual([])
  })
})

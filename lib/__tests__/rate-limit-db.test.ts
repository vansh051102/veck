jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    rateLimit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  },
}))

import { DBRateLimiter } from '../rate-limit-db'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock
  rateLimit: { deleteMany: jest.Mock }
}

function makeRequest(ip = '127.0.0.1', path = '/api/v1/quotes'): Request {
  return new Request(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('DBRateLimiter', () => {
  let limiter: DBRateLimiter

  beforeEach(() => {
    mockPrisma.$queryRaw.mockReset()
    mockPrisma.rateLimit.deleteMany.mockClear()
    limiter = new DBRateLimiter({ windowMs: 60_000, maxRequests: 3 })
  })

  it('allows the first request', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(1) }])
    const result = await limiter.check(makeRequest())
    expect(result).toEqual({ allowed: true, retryAfter: 0 })
  })

  it('blocks when exceeding maxRequests', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(5) }])
    const result = await limiter.check(makeRequest())
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('falls back to in-memory store when DB throws', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB connection lost'))
    const result = await limiter.check(makeRequest())
    expect(result).toEqual({ allowed: true, retryAfter: 0 })
  })

  it('in-memory fallback blocks after exceeding limit', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'))
    const req = makeRequest('10.0.0.1')

    const r1 = await limiter.check(req)
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check(req)
    expect(r2.allowed).toBe(true)

    const r3 = await limiter.check(req)
    expect(r3.allowed).toBe(true)

    const r4 = await limiter.check(req)
    expect(r4.allowed).toBe(false)
    expect(r4.retryAfter).toBeGreaterThan(0)
  })

  it('uses x-real-ip fallback when x-forwarded-for is absent', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(1) }])
    const req = new Request('http://localhost/api/v1/quotes', {
      headers: { 'x-real-ip': '10.0.0.2' },
    })
    const result = await limiter.check(req)
    expect(result.allowed).toBe(true)
  })

  it('respects distinct endpoints for rate limiting', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(1) }])
    const r1 = await limiter.check(makeRequest('1.2.3.4', '/api/v1/quotes'))
    const r2 = await limiter.check(makeRequest('1.2.3.4', '/api/v1/contacts'))
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
  })
})
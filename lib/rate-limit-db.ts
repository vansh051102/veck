import { prisma } from './db'

interface RateLimiterOptions {
  windowMs?: number
  maxRequests?: number
}

export class DBRateLimiter {
  private windowMs: number
  private maxRequests: number
  private inMemoryStore = new Map<string, { count: number; resetAt: number }>()
  private checkCount = 0

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000
    this.maxRequests = options.maxRequests ?? 60
  }

  private getKey(req: Request): { orgId: string; endpoint: string } {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'anonymous'
    const url = new URL(req.url)
    const endpoint = url.pathname.replace(/^\/api\/v1\//, '')
    return { orgId: ip, endpoint }
  }

  async check(req: Request): Promise<{ allowed: boolean; retryAfter: number }> {
    const { orgId, endpoint } = this.getKey(req)
    const now = Date.now()
    const windowId = now - (now % this.windowMs)

    try {
      const [result] = await prisma.$queryRaw<Array<{ count: bigint }>>`
        INSERT INTO "RateLimit" ("id", "orgId", "endpoint", "windowId", "count", "updatedAt")
        VALUES (gen_random_uuid(), ${orgId}, ${endpoint}, ${BigInt(windowId)}, 1, NOW())
        ON CONFLICT ("orgId", "endpoint", "windowId")
        DO UPDATE SET "count" = "RateLimit"."count" + 1, "updatedAt" = NOW()
        RETURNING "count"
      `

      const count = Number(result?.count ?? 1)

      this.pruneIfNeeded()

      if (count > this.maxRequests) {
        const retryAfter = Math.ceil((windowId + this.windowMs - now) / 1000)
        return { allowed: false, retryAfter: Math.max(1, retryAfter) }
      }

      return { allowed: true, retryAfter: 0 }
    } catch {
      return this.inMemoryCheck(req)
    }
  }

  private inMemoryCheck(req: Request): { allowed: boolean; retryAfter: number } {
    const { orgId, endpoint } = this.getKey(req)
    const key = `${orgId}:${endpoint}`
    const now = Date.now()

    const entry = this.inMemoryStore.get(key)
    if (!entry || now > entry.resetAt) {
      this.inMemoryStore.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, retryAfter: 0 }
    }

    entry.count++
    if (entry.count > this.maxRequests) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
    }

    return { allowed: true, retryAfter: 0 }
  }

  private pruneIfNeeded(): void {
    this.checkCount++
    if (this.checkCount % 100 !== 0) return

    const cutoff = new Date(Date.now() - this.windowMs * 2)
    prisma.rateLimit
      .deleteMany({ where: { updatedAt: { lt: cutoff } } })
      .catch(() => {})
  }
}

export const authLimiter = new DBRateLimiter({ windowMs: 60_000, maxRequests: 10 })
export const webhookLimiter = new DBRateLimiter({ windowMs: 60_000, maxRequests: 30 })
export const apiLimiter = new DBRateLimiter({ windowMs: 60_000, maxRequests: 120 })
export const mutatingLimiter = new DBRateLimiter({ windowMs: 60_000, maxRequests: 30 })
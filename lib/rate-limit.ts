// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================
// In-memory sliding window rate limiter. Suitable for single-instance
// deployments. For multi-instance/production, swap the store for Redis
// (e.g., @upstash/ratelimit).
//
// Usage:
//   const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })
//   if (!limiter.isAllowed(req)) {
//     throw new RateLimitError('Too many requests')
//   }

interface RateLimiterOptions {
  /** Time window in milliseconds (default: 60 seconds) */
  windowMs?: number
  /** Maximum requests per window (default: 60) */
  maxRequests?: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private windowMs: number
  private maxRequests: number

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000
    this.maxRequests = options.maxRequests ?? 60
  }

  /**
   * Get the rate limit key for a request.
   * Uses IP + user-agent as a rough fingerprint. In production with Redis,
   * you'd want a more robust identifier (e.g., API key or JWT sub claim).
   */
  private getKey(req: Request): string {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '127.0.0.1'
    const ua = req.headers.get('user-agent') ?? 'unknown'
    return `${ip}:${ua}`
  }

  /**
   * Check if a request is allowed. Returns { allowed, retryAfter }.
   */
  check(req: Request): { allowed: boolean; retryAfter: number } {
    const key = this.getKey(req)
    const now = Date.now()

    const entry = this.store.get(key)

    // New entry or window expired — reset
    if (!entry || now > entry.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      })
      return { allowed: true, retryAfter: 0 }
    }

    // Within window — increment
    entry.count++

    if (entry.count > this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return { allowed: false, retryAfter }
    }

    return { allowed: true, retryAfter: 0 }
  }

  /**
   * Periodic cleanup of expired entries to prevent memory leaks.
   * Call this on a timer or after each check.
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

// ============================================================================
// PRE-CONFIGURED LIMITERS
// ============================================================================

/** Auth endpoints: 10 requests per minute */
export const authLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })

/** Webhook endpoints: 30 requests per minute */
export const webhookLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 30 })

/** General API: 120 requests per minute */
export const apiLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 120 })

/** Mutating endpoints (POST/PUT/DELETE): 30 requests per minute */
export const mutatingLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 30 })

// ============================================================================
// MIDDLEWARE HELPER
// ============================================================================

import { NextResponse } from 'next/server'

export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      // Match the standard error envelope produced by errorResponse().
      meta: {
        statusCode: 429,
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

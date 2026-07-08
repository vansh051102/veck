import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for secrets (cron/webhook tokens).
 * Returns false on length mismatch (length is not itself secret here) and
 * otherwise compares in constant time to avoid leaking the secret via timing.
 */
export function secureEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

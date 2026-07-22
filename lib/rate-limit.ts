import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'

type RateLimitRecord = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

// This limiter is used by the SMS endpoints, where an attacker can supply an
// arbitrary source IP. Keep the fallback limiter bounded even when the app is
// deployed without a distributed rate-limit RPC.
const RATE_LIMIT_STORE = new BoundedTtlMap<string, RateLimitRecord>(10_000)

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  const record = RATE_LIMIT_STORE.get(key, now)
  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt }, resetAt, now)
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      limit,
    }
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      limit,
    }
  }

  record.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
    limit,
  }
}

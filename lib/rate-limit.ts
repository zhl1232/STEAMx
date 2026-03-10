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

const RATE_LIMIT_STORE = new Map<string, RateLimitRecord>()
const PRUNE_INTERVAL_MS = 60_000
let lastPruneAt = 0

function pruneExpired(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return
  for (const [key, record] of RATE_LIMIT_STORE) {
    if (record.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key)
    }
  }
  lastPruneAt = now
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  pruneExpired(now)

  const record = RATE_LIMIT_STORE.get(key)
  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt })
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

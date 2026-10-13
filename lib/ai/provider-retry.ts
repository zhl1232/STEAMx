export const MAX_PROVIDER_ATTEMPTS = 3
export type ProviderRetry = 'stop' | 'switch' | 'backoff'

function errorText(details: unknown): string {
  if (!details || typeof details !== 'object') return typeof details === 'string' ? details : ''
  const value = details as { code?: unknown; message?: unknown; error?: unknown }
  return [value.code, value.message, value.error && typeof value.error === 'object'
    ? errorText(value.error) : value.error].filter(value => typeof value === 'string').join(' ')
}

/** Never classify arbitrary permission/account/billing failures as model outages. */
export function classifyProviderFailure(status: number, details?: unknown): ProviderRetry {
  const text = errorText(details)
  if (/arrearage|insufficient[_ .-]?balance|account.{0,24}(?:disabled|blocked|suspend)|invalid[_ .-]?(?:api[_ .-]?)?key|unauth|access.?denied|free.?tier|free.?quota|billing|payment.required/i.test(text)) return 'stop'
  if (status === 401 || status === 403) return 'stop'
  if ((status === 400 || status === 404) && /(?:model.{0,60}(?:not.?found|not.?exist|not.?available|not.?supported|unsupported)|(?:not.?found|unsupported).{0,30}model)/i.test(text)) return 'switch'
  if (status === 429) {
    // AllocationQuota is often the model's per-minute token budget, not money owed.
    if (/quota|throttl|rate.?limit|too.many.requests|capacity/i.test(text)) return 'backoff'
    return 'stop'
  }
  return [408, 500, 502, 503, 504].includes(status) ? 'backoff' : 'stop'
}

export function providerRetryDelayMs(attempt: number, retryAfter: string | null, now = Date.now(), random = Math.random): number {
  if (retryAfter?.trim()) {
    const raw = retryAfter.trim()
    if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.ceil(Number(raw) * 1000)
    const date = Date.parse(raw)
    if (Number.isFinite(date)) return Math.max(0, date - now)
  }
  return Math.min(2000, 250 * 2 ** Math.min(Math.max(0, attempt), 3)) + Math.floor(random() * 250)
}

export async function waitForProviderRetry(delayMs: number, deadline: number): Promise<boolean> {
  if (!Number.isFinite(delayMs) || delayMs < 0 || Date.now() + delayMs >= deadline) return false
  if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs))
  return Date.now() < deadline
}

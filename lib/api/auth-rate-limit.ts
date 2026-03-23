import { RateLimitError } from '@/lib/api/auth'
import { consumeRateLimit } from '@/lib/rate-limit'

type MemoryRateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function requireRequestRateLimit(
  request: Request,
  options: MemoryRateLimitOptions & { suffix?: string }
) {
  const ip = getRequestIp(request)
  const suffix = options.suffix ? `:${options.suffix}` : ''
  const result = consumeRateLimit(`${options.key}:${ip}${suffix}`, options.limit, options.windowMs)

  if (!result.allowed) {
    const resetAt = Math.ceil(result.resetAt / 1000)
    const retryAfterSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))

    throw new RateLimitError('请求过于频繁，请稍后再试', {
      limit: result.limit,
      remaining: result.remaining,
      resetAt,
      retryAfterSeconds,
    })
  }
}

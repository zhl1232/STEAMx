import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { RateLimitError } from '@/lib/api/auth'

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  ok?: boolean
  error?: string
  limit?: number
  remaining?: number
  reset_at?: number
}

export async function requireRateLimit(
  supabase: SupabaseClient<Database>,
  options: RateLimitOptions
) {
  const windowSeconds = Math.max(1, Math.floor(options.windowMs / 1000))

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: options.key,
    p_limit: options.limit,
    p_window_seconds: windowSeconds,
  } as never)

  if (error) throw error

  const result = (data ?? null) as RateLimitResult | null
  if (!result?.ok) {
    const resetAt = typeof result?.reset_at === 'number'
      ? result.reset_at
      : Math.ceil(Date.now() / 1000) + windowSeconds
    const retryAfterSeconds = Math.max(0, resetAt - Math.floor(Date.now() / 1000))

    throw new RateLimitError('Too many requests', {
      limit: result?.limit ?? options.limit,
      remaining: result?.remaining ?? 0,
      resetAt,
      retryAfterSeconds,
    })
  }
}

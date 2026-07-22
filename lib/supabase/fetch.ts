const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 12_000
const MIN_SUPABASE_FETCH_TIMEOUT_MS = 1_000
const MAX_SUPABASE_FETCH_TIMEOUT_MS = 60_000

export function getSupabaseFetchTimeoutMs() {
  const configured = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS)
  if (!Number.isFinite(configured)) return DEFAULT_SUPABASE_FETCH_TIMEOUT_MS

  return Math.min(
    MAX_SUPABASE_FETCH_TIMEOUT_MS,
    Math.max(MIN_SUPABASE_FETCH_TIMEOUT_MS, Math.round(configured)),
  )
}

/**
 * Bound the complete Supabase response, including its JSON body. During DNS or
 * upstream outages, this prevents each page request from retaining an open
 * PostgREST request until the operating system's much longer network timeout.
 */
export function fetchWithSupabaseTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const timeoutSignal = AbortSignal.timeout(getSupabaseFetchTimeoutMs())
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal

  return fetch(input, { ...init, signal })
}

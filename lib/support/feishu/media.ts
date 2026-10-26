import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { fetchWithSupabaseTimeout } from '@/lib/supabase/fetch'
import { FeishuBridgeError } from './config'

/** Upload's SDK options do not forward signals; bind cancellation at its fetch boundary. */
export function feishuStorage(operationSignal: AbortSignal) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let origin: string
  try {
    const url = new URL(configuredUrl ?? '')
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !key) throw new Error()
    origin = url.origin
  } catch { throw new FeishuBridgeError('storage_unavailable') }
  return createClient(configuredUrl!, key!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: async (input, init = {}) => {
      try {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.origin !== origin || !url.pathname.startsWith('/storage/v1/')) throw new Error()
        const signal = AbortSignal.any([operationSignal, AbortSignal.timeout(12000), ...(init.signal ? [init.signal] : [])])
        signal.throwIfAborted()
        return await fetchWithSupabaseTimeout(input, { ...init, signal, redirect: 'error' })
      } catch { throw new FeishuBridgeError('storage_unavailable') }
    } },
  }).storage.from('support-private')
}

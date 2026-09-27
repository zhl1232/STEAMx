import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { requireRole } from '@/lib/api/auth'
import { StoreServiceError } from '@/lib/store/service'
import { isStoreCheckoutEnabled, isStorePreviewEnabled } from '@/lib/store/config'

/** A hidden button is not a checkout gate. Call before any order mutation. */
export async function requireStoreCheckoutAccess(client: SupabaseClient<Database>): Promise<void> {
  if (isStoreCheckoutEnabled()) return
  if (isStorePreviewEnabled()) {
    await requireRole(client, ['admin'])
    return
  }
  throw new StoreServiceError('材料包购买暂未开放', 'STORE_CHECKOUT_DISABLED', 503)
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  // Non-browser signed/cron requests use separate endpoints. Session mutation
  // requests without Origin remain usable by same-site non-browser clients.
  if (origin && origin !== new URL(request.url).origin) {
    throw new StoreServiceError('请求来源无效', 'INVALID_ORIGIN', 403)
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new StoreServiceError('请求来源无效', 'INVALID_ORIGIN', 403)
  }
}

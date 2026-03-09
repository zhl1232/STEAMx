import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from './env'
import type { Database } from './types'

/**
 * 浏览器端 Supabase 客户端
 * 用于客户端组件中访问 Supabase
 */

export const createClient = (): SupabaseClient<Database> => {
  const { url, anonKey } = getSupabaseEnv()

  return createBrowserClient<Database>(
    url,
    anonKey,
  )
}

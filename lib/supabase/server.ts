import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from './env'
import type { Database } from './types'

/**
 * 服务端 Supabase 客户端
 * 用于 Server Components 和 API Routes
 */
export const createClient = async (): Promise<SupabaseClient<Database, 'public'>> => {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // 在 Server Component 中可能会失败，可以安全忽略
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // 在 Server Component 中可能会失败，可以安全忽略
          }
        },
      },
    }
  )
}

/**
 * 仅用于公开读取，不依赖请求级 cookie（可用于缓存函数）。
 */
export const createPublicClient = (): SupabaseClient<Database, 'public'> => {
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get() {
          return undefined
        },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  )
}

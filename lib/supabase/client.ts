import { createBrowserClient } from '@supabase/ssr'


/**
 * 浏览器端 Supabase 客户端
 * 用于客户端组件中访问 Supabase
 */
import { SupabaseClient } from '@supabase/supabase-js'


export const createClient = (): SupabaseClient<any, 'public', any> => {
  return createBrowserClient<any, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}


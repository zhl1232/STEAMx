import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * 管理员客户端（仅在服务端使用）
 * 警告：包含 service_role 密钥，仅在 API Routes 或 Server Components 中使用
 *
 * 重要：不要在客户端组件中导入此文件！
 * 若未配置 SUPABASE_SERVICE_ROLE_KEY，则为 null，调用方需判空并返回友好错误（避免模块加载时抛错导致 500 HTML 页）
 */
const _url = process.env.NEXT_PUBLIC_SUPABASE_URL
const _key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin =
  _url && _key
    ? createSupabaseClient<Database>(_url, _key, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : (null as unknown as ReturnType<typeof createSupabaseClient<Database>>)

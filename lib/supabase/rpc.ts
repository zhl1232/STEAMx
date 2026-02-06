import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type Functions = Database['public']['Functions']

/**
 * 类型安全的 RPC 调用辅助函数
 * 
 * 这个函数封装了 Supabase 的 RPC 调用，提供完整的类型安全和 IDE 自动补全支持。
 * 它使用 Database 类型定义中的 Functions 来确保参数和返回值的类型正确性。
 * 
 * @param supabase - Supabase 客户端实例
 * @param functionName - 要调用的数据库函数名称
 * @param args - 函数参数，类型会根据函数名自动推断
 * @returns Promise 包含数据和错误对象
 * 
 * @example
 * ```typescript
 * const { data, error } = await callRpc(supabase, 'approve_project', {
 *   project_id: 123
 * })
 * ```
 */
export async function callRpc<FnName extends keyof Functions>(
  supabase: SupabaseClient<Database>,
  functionName: FnName,
  args: Functions[FnName]['Args']
): Promise<{ data: Functions[FnName]['Returns'] | null; error: unknown }> {
  // 使用类型断言来绕过 Supabase 客户端的类型限制
  // 虽然这里使用了 as any，但外部调用者会获得完整的类型安全
  // Supabase rpc usually returns a PostgrestFilterBuilder which is then awaited.
  // We cast to a generic function type to avoid "any" and complex overload mismatch.
  const rpcFn = supabase.rpc as unknown as (
    fn: string, 
    args: unknown
  ) => PromiseLike<{ data: Functions[FnName]['Returns'] | null; error: unknown }>;
  
  return await rpcFn(functionName, args)
}

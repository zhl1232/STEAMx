import { NextResponse } from 'next/server'
import { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * 认证错误类
 */
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * 权限错误类
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * 要求用户已认证
 * @param supabase Supabase 客户端
 * @returns 已认证的用户对象
 * @throws AuthError 如果用户未认证
 */
export async function requireAuth(
  supabase: SupabaseClient<Database>
): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError('Unauthorized')
  }

  return user
}

/**
 * 要求用户具有指定角色
 * @param supabase Supabase 客户端
 * @param allowedRoles 允许的角色列表
 * @returns 用户对象和用户资料
 * @throws AuthError 如果用户未认证
 * @throws PermissionError 如果用户没有所需角色
 */
export async function requireRole(
  supabase: SupabaseClient<Database>,
  allowedRoles: ('user' | 'moderator' | 'admin')[]
): Promise<{ user: User; role: string }> {
  const user = await requireAuth(supabase)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new PermissionError('Failed to fetch user profile')
  }

  // 类型断言：Supabase 生成的类型可能未包含 role 字段
  const userRole = (profile as { role: string }).role as 'user' | 'moderator' | 'admin'

  if (!allowedRoles.includes(userRole)) {
    throw new PermissionError(
      `Permission denied: requires one of [${allowedRoles.join(', ')}]`
    )
  }

  return { user, role: userRole }
}

/**
 * 处理 API 错误并返回适当的响应
 * @param error 错误对象
 * @returns NextResponse
 */
export function handleApiError(error: unknown): NextResponse {
  // 开发环境记录详细错误
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', error)
  }

  // 认证错误
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  // 权限错误
  if (error instanceof PermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }

  // 其他错误 - 生产环境隐藏详细信息
  const errorMessage =
    process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Internal server error')
      : 'Internal server error'

  return NextResponse.json({ error: errorMessage }, { status: 500 })
}

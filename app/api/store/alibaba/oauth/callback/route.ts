import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { encryptStoreSecret } from '@/lib/store/secret-crypto'
import { Alibaba1688Client, Alibaba1688Error, getAlibaba1688Config } from '@/lib/store/alibaba-1688'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function clearStateCookie(response: NextResponse) {
  response.cookies.set('store_alibaba_oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/store/alibaba/oauth',
  })
  return response
}

/** OAuth callback. Persists encrypted credentials using service-role only. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  try {
    await requireRole(supabase, ['admin'])
    const expectedState = request.cookies.get('store_alibaba_oauth_state')?.value
    const state = request.nextUrl.searchParams.get('state')
    const code = request.nextUrl.searchParams.get('code')
    if (!expectedState || !state || state !== expectedState) {
      return clearStateCookie(NextResponse.json({ error: 'OAuth state 校验失败' }, { status: 400 }))
    }
    if (request.nextUrl.searchParams.get('error')) {
      return clearStateCookie(NextResponse.json({ error: '1688 OAuth 授权被取消' }, { status: 400 }))
    }
    if (!code) return clearStateCookie(NextResponse.json({ error: '1688 OAuth 缺少授权码' }, { status: 400 }))
    if (!supabaseAdmin) return clearStateCookie(NextResponse.json({ error: '数据库管理员密钥尚未配置' }, { status: 503 }))

    const config = getAlibaba1688Config()
    const client = new Alibaba1688Client(config)
    const token = await client.exchangeCodeForTokens(code)
    if (!token.access_token) throw new Error('1688 OAuth 未返回 access token')

    const expiresIn = Number(token.expires_in)
    const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null
    const scopes = typeof token.scope === 'string'
      ? token.scope.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
      : []

    const { error } = await supabaseAdmin.from('store_alibaba_connections').upsert({
      connection_key: 'default',
      member_id: typeof token.memberId === 'string' ? token.memberId : typeof token.resource_owner === 'string' ? token.resource_owner : null,
      access_token_encrypted: encryptStoreSecret(token.access_token),
      refresh_token_encrypted: token.refresh_token ? encryptStoreSecret(token.refresh_token) : null,
      expires_at: expiresAt,
      scopes,
      status: 'active',
      metadata: { connectedAt: new Date().toISOString() },
    }, { onConflict: 'connection_key' })
    if (error) throw error

    return clearStateCookie(NextResponse.redirect(new URL('/admin/store?alibaba=connected', request.url)))
  } catch (error) {
    if (error instanceof Alibaba1688Error) {
      // 不把第三方响应（其中可能包含授权上下文）回传给浏览器或写入 API 错误日志。
      return clearStateCookie(NextResponse.json({ error: '1688 OAuth 暂时失败，请稍后重试', code: 'ALIBABA_OAUTH_FAILED' }, { status: 502 }))
    }
    return clearStateCookie(handleApiError(error))
  }
}

import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'

import { handleApiError, requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { Alibaba1688Client, getAlibaba1688Config } from '@/lib/store/alibaba-1688'

export const dynamic = 'force-dynamic'

/** Start the server-side 1688 OAuth flow. Admin-only; token never reaches the browser. */
export async function GET() {
  const supabase = await createClient()
  try {
    await requireRole(supabase, ['admin'])
    const config = getAlibaba1688Config()
    if (!config.configured) {
      return NextResponse.json({ error: '1688 OAuth 尚未配置', code: 'ALIBABA_OAUTH_NOT_CONFIGURED' }, { status: 503 })
    }
    const state = randomBytes(32).toString('base64url')
    const scope = process.env.ALIBABA_1688_SCOPE?.trim()
    const url = new Alibaba1688Client(config).getAuthorizationUrl(state, scope ? { scope } : undefined)
    const response = NextResponse.redirect(url)
    response.cookies.set('store_alibaba_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/store/alibaba/oauth',
    })
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

import { logger } from '@/lib/logger'
import { ensureProfile } from '@/lib/auth/ensure-profile'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalHref } from '@/lib/utils/safe-internal-href'
import { NextResponse } from 'next/server'

function getSafeNextPath(requestUrl: URL) {
  return sanitizeInternalHref(requestUrl.searchParams.get('next'))
}

function buildLoginRedirectUrl(requestUrl: URL, nextPath: string, authError: string) {
  const loginUrl = new URL('/login', requestUrl.origin)
  if (nextPath !== '/') {
    loginUrl.searchParams.set('next', nextPath)
  }
  loginUrl.searchParams.set('authError', authError)
  return loginUrl
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const nextPath = getSafeNextPath(requestUrl)
  const providerError = requestUrl.searchParams.get('error')

  if (providerError) {
    return NextResponse.redirect(
      buildLoginRedirectUrl(requestUrl, nextPath, 'auth_callback_failed')
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        buildLoginRedirectUrl(requestUrl, nextPath, 'auth_callback_failed')
      )
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await ensureProfile({ userId: user.id, userMetadata: user.user_metadata, phone: user.phone })
      }
    } catch {
      logger.error('[auth/callback] profile recovery user lookup failed')
    }
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}

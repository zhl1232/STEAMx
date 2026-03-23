import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getSafeNextPath(requestUrl: URL) {
  const next = requestUrl.searchParams.get('next')
  if (!next || !next.startsWith('/')) {
    return '/'
  }

  if (next.startsWith('//')) {
    return '/'
  }

  return next
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
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}

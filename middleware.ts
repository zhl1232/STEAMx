import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/env'
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'

/**
 * Next.js Edge Middleware
 * 用于在每个请求中刷新 Supabase 认证 token (必须是 Edge 兼容的)
 *
 * 注意：当前保留 `middleware.ts` 是有意为之。
 * 在 OpenNext Cloudflare 目标下仍需使用 Edge middleware，
 * 暂不迁移到 Next.js 16 的 `proxy.ts`。
 */
export async function middleware(request: NextRequest) {
  if (isPlaywrightSmoke()) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  const { url, anonKey } = getSupabaseEnv()
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

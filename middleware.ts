import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/env'
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'
import { consumeRateLimit } from '@/lib/rate-limit'

type RateLimitRule = {
  id: string
  methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[]
  pathPrefix: string
  limit: number
  windowMs: number
}

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

  if (request.method === 'OPTIONS') {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  const rateLimited = applyRateLimit(request)
  if (rateLimited) {
    return rateLimited
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

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    id: 'api-read',
    methods: ['GET'],
    pathPrefix: '/api/',
    limit: 120,
    windowMs: 60_000,
  },
  {
    id: 'api-write',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    pathPrefix: '/api/',
    limit: 30,
    windowMs: 60_000,
  },
]

function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  return 'unknown'
}

function applyRateLimit(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) return null

  const ip = getClientIp(request)
  if (ip === 'unknown') return null
  for (const rule of RATE_LIMIT_RULES) {
    if (!request.method || !rule.methods.includes(request.method as RateLimitRule['methods'][number])) {
      continue
    }
    if (!pathname.startsWith(rule.pathPrefix)) continue

    const key = `${rule.id}:${ip}`
    const result = consumeRateLimit(key, rule.limit, rule.windowMs)
    if (!result.allowed) {
      const retryAfterSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))
      const resetSeconds = Math.ceil(result.resetAt / 1000)
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(resetSeconds),
          },
        }
      )
    }
  }

  return null
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

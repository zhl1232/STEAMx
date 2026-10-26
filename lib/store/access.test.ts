import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSameOrigin } from './access'

const publicOrigin = 'https://steam.bj.cn'
const upstreamUrl = 'http://0.0.0.0:3000/api/store/quote'
const siteEnvKeys = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  for (const key of siteEnvKeys) vi.stubEnv(key, '')
})
afterEach(() => vi.unstubAllEnvs())

function request(origin: string | undefined = publicOrigin, headers: Record<string, string> = {}, url = upstreamUrl) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { ...(origin === undefined ? {} : { origin }), ...headers },
    body: '{}',
  })
}

function expectRejected(input: Request) {
  expect(() => requireSameOrigin(input)).toThrowError(expect.objectContaining({
    code: 'INVALID_ORIGIN', statusCode: 403,
  }))
}

describe('store session request origin validation', () => {
  it.each(['http://0.0.0.0:3000', 'http://127.0.0.1:3000', 'http://steam.bj.cn:3000'])(
    'accepts canonical HTTPS browser requests through standalone upstream %s', (upstream) => {
      const input = request(publicOrigin, {
        host: 'steam.bj.cn', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin',
      }, `${upstream}/api/store/quote`)
      // This inequality reproduced the previous 403 before authentication.
      expect(input.headers.get('origin')).not.toBe(new URL(input.url).origin)
      expect(() => requireSameOrigin(input)).not.toThrow()
    },
  )

  it('also accepts a direct canonical Request without proxy headers', () => {
    expect(() => requireSameOrigin(new Request(`${publicOrigin}/api/store/quote`, {
      method: 'POST', headers: { origin: publicOrigin },
    }))).not.toThrow()
  })

  it.each(['https://evil.example', 'https://steam.bj.cn.evil.example', 'http://steam.bj.cn', 'https://steam.bj.cn:444',
    'null', 'invalid', 'https://steam.bj.cn/path', 'https://steam.bj.cn https://evil.example'])(
    'rejects untrusted or malformed Origin %s', (origin) => expectRejected(request(origin)),
  )

  it('rejects an attacker origin even when all host/proxy headers and the request URL match it', () => {
    expectRejected(request('https://evil.example', {
      host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https',
      forwarded: 'host=evil.example;proto=https', 'sec-fetch-site': 'same-origin',
    }, 'https://evil.example/api/store/quote'))
  })

  it('does not let forged proxy headers override the trusted canonical origin', () => {
    expect(() => requireSameOrigin(request(publicOrigin, {
      host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http',
    }))).not.toThrow()
  })

  it.each(['http://127.0.0.1:3000', 'https://evil.example', '://invalid', 'javascript:alert(1)', ''])(
    'keeps the production canonical allowlist when site configuration is %s', (value) => {
      for (const key of siteEnvKeys) vi.stubEnv(key, value)
      expect(() => requireSameOrigin(request())).not.toThrow()
      expectRejected(request('https://evil.example'))
      expectRejected(request('http://127.0.0.1:3000'))
    },
  )

  it.each([publicOrigin, undefined])('rejects explicit cross-site metadata with Origin %s', (origin) => {
    const input = request(publicOrigin, { 'sec-fetch-site': 'cross-site' })
    if (origin === undefined) input.headers.delete('origin')
    expectRejected(input)
  })

  it('preserves origin-less same-site non-browser requests', () => {
    const input = request()
    input.headers.delete('origin')
    expect(() => requireSameOrigin(input)).not.toThrow()
  })

  it.each(['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:4173'])(
    'preserves local development direct same-origin requests on %s', (origin) => {
      vi.stubEnv('NODE_ENV', 'development')
      const input = new Request(`${origin}/api/store/quote`, { method: 'POST', headers: { origin } })
      expect(() => requireSameOrigin(input)).not.toThrow()
      expectRejected(request('https://evil.example', {}, `${origin}/api/store/quote`))
    },
  )

  it('supports the existing configured development site behind a proxy', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.com')
    expect(() => requireSameOrigin(request('https://preview.example.com'))).not.toThrow()
    expectRejected(request('https://evil.example'))
  })
})

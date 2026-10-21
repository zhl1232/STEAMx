import * as fs from 'node:fs/promises'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH, POST } from './route'

vi.mock('node:fs/promises', { spy: true })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('LDraw preview environment boundary', () => {
  it.each(['production', 'test', ''])('rejects %s before parsing or filesystem work', async (mode) => {
    vi.stubEnv('NODE_ENV', mode)
    const reads = vi.spyOn(fs, 'readFile')
    const scans = vi.spyOn(fs, 'readdir')
    const writes = vi.spyOn(fs, 'writeFile')
    for (const handler of [GET, POST, PATCH]) {
      const request = new NextRequest('http://localhost:3000/api/ldraw-preview?model=3-hu-die.ldr', {
        method: handler.name,
        headers: { origin: 'http://localhost:3000', host: 'dev.steamx.cc' },
        ...(handler === GET ? {} : { body: '{invalid' }),
      })
      const parse = vi.spyOn(request, 'json')
      const response = await handler(request)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Not Found' })
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
      expect(parse).not.toHaveBeenCalled()
    }
    expect(reads).not.toHaveBeenCalled()
    expect(scans).not.toHaveBeenCalled()
    expect(writes).not.toHaveBeenCalled()
  })

  it.each([
    undefined, 'https://evil.example', 'http://localhost:3001',
    'https://localhost:3000', 'null', 'not-a-url',
  ])('preserves PATCH rejection for origin %s', async (origin) => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new NextRequest('http://localhost:3000/api/ldraw-preview', {
      method: 'PATCH', headers: origin ? { origin } : {}, body: '{invalid',
    })
    const parse = vi.spyOn(request, 'json')
    expect((await PATCH(request)).status).toBe(403)
    expect(parse).not.toHaveBeenCalled()
  })

  it('rejects even same-origin PATCH on a public development hostname', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await PATCH(new NextRequest('https://dev.steamx.cc/api/ldraw-preview', {
      method: 'PATCH', headers: { origin: 'https://dev.steamx.cc' }, body: '{}',
    }))).status).toBe(403)
  })

  it('allows same-origin localhost PATCH to reach validation without writing', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const writes = vi.spyOn(fs, 'writeFile')
    expect((await PATCH(new NextRequest('http://localhost:3000/api/ldraw-preview', {
      method: 'PATCH', headers: { origin: 'http://localhost:3000' }, body: '{}',
    }))).status).toBe(400)
    expect(writes).not.toHaveBeenCalled()
  })

  it.each(['127.0.0.1', '[::1]'])('keeps rejecting %s when Next normalizes the request origin to localhost', async (host) => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new NextRequest(`http://${host}:3000/api/ldraw-preview`, {
      method: 'PATCH', headers: { origin: `http://${host}:3000` }, body: '{}',
    })
    expect(new URL(request.url).hostname).toBe('localhost')
    expect((await PATCH(request)).status).toBe(403)
  })
})

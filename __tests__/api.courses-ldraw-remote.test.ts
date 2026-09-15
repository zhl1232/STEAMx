/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/courses/ldraw-step/route'
import { hasLdrawModelFile } from '@/lib/courses/ldraw-bom-source'

const valid = '0 FILE remote.mpd\n0 STEP\n1 4 0 0 0 1 0 0 0 1 0 0 0 0 1 part.dat\n'

function request(model: string, step = '0') {
  return new NextRequest(`https://www.steamx.cc/api/courses/ldraw-step?model=${encodeURIComponent(model)}&step=${step}`)
}

describe('GET /api/courses/ldraw-step with remote assets', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ASSETS_BASE_URL
    vi.restoreAllMocks()
  })

  it('returns a packed step from OSS', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(valid)))

    const response = await GET(request('remote-route-unique.mpd'))
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ldraw-step-count')).toBe('2')
    expect(await response.text()).toContain('0 FILE')
  })

  it('keeps remote 404 distinct from a temporary 503', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 })))

    expect((await GET(request('route-missing-unique.mpd'))).status).toBe(404)
    expect((await GET(request('route-down-unique.mpd'))).status).toBe(503)
  })

  it('rejects traversal and invalid extensions before making a network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect((await GET(request('../escape.mpd'))).status).toBe(400)
    expect((await GET(request('escape.ldr'))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 413 for an oversized remote content-length', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(valid, {
      headers: { 'content-length': String(16 * 1024 * 1024 + 1) },
    })))

    expect((await GET(request('route-large-unique.mpd'))).status).toBe(413)
  })

  it('trusts immutable 64-hex model URLs for sitemap discovery without issuing GET/HEAD requests', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const urls = Array.from({ length: 100 }, (_, index) =>
      `https://assets.example.test/courses/ldraw/model-${index.toString(16).padStart(2, '0')}${'a'.repeat(62)}.mpd`,
    )

    const found = await Promise.all(urls.map((url) => hasLdrawModelFile(url)))
    expect(found).toEqual(Array(100).fill(true))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

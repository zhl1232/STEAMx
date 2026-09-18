import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  canonicalizeAssetPathname,
  signAssetProxyUrl,
  stripAssetSignatureSearch,
  verifyAssetSignature,
} from './signed-asset-url'

describe('signed-asset-url', () => {
  beforeEach(() => {
    vi.stubEnv('ASSETS_URL_SIGNING_SECRET', 'test-assets-signing-secret')
    vi.stubEnv('ASSETS_URL_SIGNING_TTL_SECONDS', '1200')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('canonicalizes unicode and percent-encoded path segments the same way', () => {
    expect(canonicalizeAssetPathname('/qimeng-preview/001_奇妙潜水艇/video_1.mp4')).toBe(
      canonicalizeAssetPathname('/qimeng-preview/001_%E5%A5%87%E5%A6%99%E6%BD%9C%E6%B0%B4%E8%89%87/video_1.mp4'),
    )
  })

  it('signs /api/assets video URLs with exp and sig', () => {
    const nowMs = 1_700_000_000_000
    const signed = signAssetProxyUrl('/api/assets/kejiao16a/demo/video_1.mp4', { nowMs })
    expect(signed).toMatch(/^\/api\/assets\/kejiao16a\/demo\/video_1\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/)
    const url = new URL(signed, 'http://localhost')
    expect(Number(url.searchParams.get('exp'))).toBe(Math.floor(nowMs / 1000) + 1200)
  })

  it('does not sign images even when secret is set', () => {
    expect(signAssetProxyUrl('/api/assets/projects/cover.webp')).toBe(
      '/api/assets/projects/cover.webp',
    )
  })

  it('leaves URLs unchanged when secret is unset', () => {
    vi.stubEnv('ASSETS_URL_SIGNING_SECRET', '')
    expect(signAssetProxyUrl('/api/assets/kejiao16a/demo/video_1.mp4')).toBe(
      '/api/assets/kejiao16a/demo/video_1.mp4',
    )
  })

  it('verifies a fresh signature and rejects missing / expired / invalid', () => {
    const nowMs = 1_700_000_000_000
    const signed = signAssetProxyUrl('/api/assets/kejiao16a/demo/video_1.mp4', { nowMs })
    const url = new URL(signed, 'http://localhost')
    const pathname = '/kejiao16a/demo/video_1.mp4'

    expect(
      verifyAssetSignature(pathname, url.searchParams.get('exp'), url.searchParams.get('sig'), {
        nowMs,
      }),
    ).toEqual({ ok: true })

    expect(verifyAssetSignature(pathname, null, null, { nowMs })).toEqual({
      ok: false,
      reason: 'missing_params',
    })

    expect(
      verifyAssetSignature(pathname, url.searchParams.get('exp'), 'deadbeef', { nowMs }),
    ).toEqual({ ok: false, reason: 'invalid' })

    const expiredExp = String(Math.floor(nowMs / 1000) - 10)
    const expiredSigned = signAssetProxyUrl('/api/assets/kejiao16a/demo/video_1.mp4', {
      nowMs,
      exp: Number(expiredExp),
    })
    const expiredUrl = new URL(expiredSigned, 'http://localhost')
    expect(
      verifyAssetSignature(
        pathname,
        expiredUrl.searchParams.get('exp'),
        expiredUrl.searchParams.get('sig'),
        { nowMs },
      ),
    ).toEqual({ ok: false, reason: 'expired' })
  })

  it('strips signing query params for upstream CDN', () => {
    expect(stripAssetSignatureSearch('?exp=1&sig=abc&x=1')).toBe('?x=1')
    expect(stripAssetSignatureSearch('?exp=1&sig=abc')).toBe('')
  })
})

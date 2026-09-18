import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  extractHttpsMp4Url,
  resolveProjectVideoPlaybackSrc,
  resolveProjectVideoUrl,
} from './video-url'

describe('extractHttpsMp4Url', () => {
  it('extracts the first https mp4 URL from mixed text', () => {
    const text =
      '【启蒙版·预览】\n演示视频（外链）：https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4\n来源：x'
    expect(extractHttpsMp4Url(text)).toBe(
      'https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4',
    )
  })

  it('returns null when no mp4 is present', () => {
    expect(extractHttpsMp4Url('只有文字')).toBeNull()
  })
})

describe('resolveProjectVideoUrl', () => {
  it('prefers videoUrl field over description / steps', () => {
    expect(
      resolveProjectVideoUrl({
        videoUrl: 'https://assets.steamx.cc/qimeng-preview/a/video_1.mp4',
        description: '演示视频（外链）：https://assets.steamx.cc/qimeng-preview/b/video_1.mp4',
        steps: [{ description: '【演示视频】https://assets.steamx.cc/qimeng-preview/c/video_1.mp4\n做实验' }],
      }),
    ).toBe('https://assets.steamx.cc/qimeng-preview/a/video_1.mp4')
  })

  it('falls back to description then steps', () => {
    expect(
      resolveProjectVideoUrl({
        description: '演示视频（外链）：https://assets.steamx.cc/qimeng-preview/b/video_1.mp4',
      }),
    ).toBe('https://assets.steamx.cc/qimeng-preview/b/video_1.mp4')

    expect(
      resolveProjectVideoUrl({
        steps: [{ description: '【演示视频】https://assets.steamx.cc/qimeng-preview/c/video_1.mp4\n下一步' }],
      }),
    ).toBe('https://assets.steamx.cc/qimeng-preview/c/video_1.mp4')
  })
})

describe('resolveProjectVideoPlaybackSrc', () => {
  const ENV_KEY = 'NEXT_PUBLIC_ASSETS_BASE_URL'
  const DISPLAY_MODE_ENV_KEY = 'NEXT_PUBLIC_ASSETS_DISPLAY_MODE'
  const SIGNING_SECRET_KEY = 'ASSETS_URL_SIGNING_SECRET'

  beforeEach(() => {
    vi.stubEnv(ENV_KEY, 'https://assets.steamx.cc')
    vi.stubEnv(DISPLAY_MODE_ENV_KEY, undefined)
    vi.stubEnv(SIGNING_SECRET_KEY, 'test-assets-signing-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rewrites qimeng-preview CDN videos through signed /api/assets', () => {
    const src = resolveProjectVideoPlaybackSrc({
      videoUrl: 'https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4',
    })
    expect(src).toMatch(
      /^\/api\/assets\/qimeng-preview\/001_%E5%A5%87%E5%A6%99%E6%BD%9C%E6%B0%B4%E8%89%87\/video_1\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
  })

  it('rewrites kejiao16a CDN mp4 through signed /api/assets (outside rewrite whitelist)', () => {
    const src = resolveProjectVideoPlaybackSrc({
      videoUrl: 'https://assets.steamx.cc/kejiao16a/some_project/video_1.mp4',
    })
    expect(src).toMatch(
      /^\/api\/assets\/kejiao16a\/some_project\/video_1\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
  })

  it('still forces /api/assets when DISPLAY_MODE=direct (never permanent CDN in video src)', () => {
    vi.stubEnv(DISPLAY_MODE_ENV_KEY, 'direct')
    const src = resolveProjectVideoPlaybackSrc({
      videoUrl: 'https://assets.steamx.cc/kejiao16a/some_project/video_1.mp4',
    })
    expect(src?.startsWith('/api/assets/kejiao16a/some_project/video_1.mp4?')).toBe(true)
    expect(src).toContain('sig=')
  })
})

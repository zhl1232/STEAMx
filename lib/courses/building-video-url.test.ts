import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CourseLessonRow } from '@/lib/courses/types'

import {
  resolveBuildingVideoPlaybackSrc,
  withSignedBuildingLessonVideo,
} from './building-video-url'

describe('resolveBuildingVideoPlaybackSrc', () => {
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

  it('rewrites courses CDN animation.mp4 through signed /api/assets', () => {
    const src = resolveBuildingVideoPlaybackSrc(
      'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/animation.mp4',
    )
    expect(src).toMatch(
      /^\/api\/assets\/courses\/3-ai-fei-er-tie-ta\/animation\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
  })

  it('signs relative /courses/.../animation.mp4 paths', () => {
    const src = resolveBuildingVideoPlaybackSrc('/courses/3-cheng-bao/animation.mp4')
    expect(src).toMatch(
      /^\/api\/assets\/courses\/3-cheng-bao\/animation\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
  })

  it('re-signs an already-proxied unsigned mp4', () => {
    const src = resolveBuildingVideoPlaybackSrc(
      '/api/assets/courses/3-chong-wu-gou/animation.mp4',
    )
    expect(src).toMatch(
      /^\/api\/assets\/courses\/3-chong-wu-gou\/animation\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
  })

  it('still forces /api/assets when DISPLAY_MODE=direct', () => {
    vi.stubEnv(DISPLAY_MODE_ENV_KEY, 'direct')
    const src = resolveBuildingVideoPlaybackSrc(
      'https://assets.steamx.cc/courses/3-bao-jian/animation.mp4',
    )
    expect(src?.startsWith('/api/assets/courses/3-bao-jian/animation.mp4?')).toBe(true)
    expect(src).toContain('sig=')
  })

  it('leaves non-proxyable local paths unchanged (no signing)', () => {
    expect(resolveBuildingVideoPlaybackSrc('/slides/rescue.mp4')).toBe('/slides/rescue.mp4')
  })

  it('returns unsigned proxy when signing secret is unset', () => {
    vi.stubEnv(SIGNING_SECRET_KEY, '')
    expect(
      resolveBuildingVideoPlaybackSrc(
        'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/animation.mp4',
      ),
    ).toBe('/api/assets/courses/3-ai-fei-er-tie-ta/animation.mp4')
  })
})

describe('withSignedBuildingLessonVideo', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ASSETS_BASE_URL', 'https://assets.steamx.cc')
    vi.stubEnv('ASSETS_URL_SIGNING_SECRET', 'test-assets-signing-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const baseLesson = {
    id: 30,
    course_id: 5,
    title: 'Eiffel',
    lesson_type: 'building_3d',
    steps: [],
    resources: [],
    starter_project_path: null,
    sort_order: 1,
    duration_minutes: 40,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as CourseLessonRow

  it('rewrites building3d.videoUrl and leaves images alone', () => {
    const lesson: CourseLessonRow = {
      ...baseLesson,
      content: {
        building3d: {
          videoUrl: 'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/animation.mp4',
          finishedImageUrl: 'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/finished.webp',
          slideImageUrls: ['https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/slides/01.webp'],
          parts: [],
          steps3d: [],
        },
      },
    }

    const next = withSignedBuildingLessonVideo(lesson)
    expect(next.content?.building3d?.videoUrl).toMatch(
      /^\/api\/assets\/courses\/3-ai-fei-er-tie-ta\/animation\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/,
    )
    expect(next.content?.building3d?.finishedImageUrl).toBe(
      'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/finished.webp',
    )
    expect(next.content?.building3d?.slideImageUrls?.[0]).toBe(
      'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/slides/01.webp',
    )
    // Original lesson object is not mutated.
    expect(lesson.content?.building3d?.videoUrl).toBe(
      'https://assets.steamx.cc/courses/3-ai-fei-er-tie-ta/animation.mp4',
    )
  })

  it('is a no-op when there is no videoUrl', () => {
    const lesson: CourseLessonRow = {
      ...baseLesson,
      content: { building3d: { parts: [], steps3d: [] } },
    }
    expect(withSignedBuildingLessonVideo(lesson)).toBe(lesson)
  })
})

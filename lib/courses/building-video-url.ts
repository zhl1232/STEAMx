/**
 * Brick/building course video playback URLs.
 *
 * Explore/project videos go through resolveProjectVideoPlaybackSrc → signed
 * /api/assets when ASSETS_URL_SIGNING_SECRET is set. Building lessons used
 * resolveAssetDisplayUrl only (unsigned proxy) → 403 on production.
 *
 * Signing uses a server-only secret, so call withSignedBuildingLessonVideo from
 * a Server Component before passing the lesson into client workspace UI.
 */

import { signAssetProxyUrl } from '@/lib/assets/signed-asset-url'
import { toForcedAssetProxyUrl } from '@/lib/utils/asset-url'
import type { CourseLessonRow } from '@/lib/courses/types'

/**
 * Same signing path as explore: force /api/assets then attach ?exp=&sig= when
 * the signing secret is configured. Non-proxyable inputs are returned unchanged.
 */
export function resolveBuildingVideoPlaybackSrc(
  videoUrl: string | null | undefined,
): string | null {
  if (videoUrl == null || typeof videoUrl !== 'string') return null
  const trimmed = videoUrl.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/api/assets/')) {
    return signAssetProxyUrl(trimmed)
  }

  const proxied = toForcedAssetProxyUrl(trimmed)
  if (proxied) return signAssetProxyUrl(proxied)

  return trimmed
}

/** Clone lesson with building3d.videoUrl rewritten to a signed playback src. */
export function withSignedBuildingLessonVideo(lesson: CourseLessonRow): CourseLessonRow {
  const raw = lesson.content?.building3d?.videoUrl
  if (typeof raw !== 'string' || !raw.trim()) return lesson

  const signed = resolveBuildingVideoPlaybackSrc(raw)
  if (!signed || signed === raw) return lesson

  const content = lesson.content
  const building3d = content?.building3d
  if (!content || !building3d) return lesson

  return {
    ...lesson,
    content: {
      ...content,
      building3d: {
        ...building3d,
        videoUrl: signed,
      },
    },
  }
}

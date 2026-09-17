/**
 * Project demo video helpers: extract CDN mp4 URLs and resolve a same-origin
 * playable src (via /api/assets) so Referer-protected OSS/CDN videos can play.
 */

import { resolveAssetDisplayUrl } from '@/lib/utils/asset-url'

const HTTPS_MP4_RE = /https:\/\/[^\s<>"')\]]+?\.mp4/gi

/** First HTTPS .mp4 URL embedded in free text (description / step body). */
export function extractHttpsMp4Url(text: string | null | undefined): string | null {
  if (!text) return null
  HTTPS_MP4_RE.lastIndex = 0
  const match = text.match(HTTPS_MP4_RE)
  if (!match?.[0]) return null
  const raw = match[0]
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    if (!url.pathname.toLowerCase().endsWith('.mp4')) return null
    // Keep the original match so unicode OSS keys stay unescaped in stored URLs.
    return raw
  } catch {
    return null
  }
}

export type ProjectVideoSource = {
  videoUrl?: string | null
  description?: string | null
  steps?: Array<{ description?: string | null } | null> | null
}

/** Prefer stored video_url; fall back to mp4 links embedded during 启蒙 import. */
export function resolveProjectVideoUrl(source: ProjectVideoSource): string | null {
  const fromField = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : ''
  if (fromField) {
    const extracted = extractHttpsMp4Url(fromField) || (fromField.startsWith('https://') ? fromField : null)
    if (extracted) return extracted
  }

  const fromDescription = extractHttpsMp4Url(source.description)
  if (fromDescription) return fromDescription

  for (const step of source.steps ?? []) {
    const fromStep = extractHttpsMp4Url(step?.description)
    if (fromStep) return fromStep
  }

  return null
}

/**
 * URL suitable for <video src>. Prefer /api/assets proxy for configured CDN
 * paths (Referer hotlink protection); otherwise return the absolute HTTPS URL.
 */
export function resolveProjectVideoPlaybackSrc(source: ProjectVideoSource): string | null {
  const absolute = resolveProjectVideoUrl(source)
  if (!absolute) return null

  const display = resolveAssetDisplayUrl(absolute)
  if (typeof display === 'string' && display.length > 0) return display
  return absolute
}

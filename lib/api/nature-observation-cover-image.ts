import { existsSync } from 'node:fs'
import path from 'node:path'

import type { SpeciesRow } from './nature-observation-internal-types'

function resolvePublicAssetUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null

  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) return null

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl
  }

  if (!trimmedUrl.startsWith('/')) {
    return null
  }

  const relativePath = trimmedUrl.replace(/^\/+/, '')
  const absolutePath = path.join(process.cwd(), 'public', relativePath)

  return existsSync(absolutePath) ? trimmedUrl : null
}

export function normalizeSpeciesRow(row: SpeciesRow): SpeciesRow {
  return {
    ...row,
    cover_image_url: resolvePublicAssetUrl(row.cover_image_url),
    audio_url: resolvePublicAssetUrl(row.audio_url),
  }
}

import { logger } from '@/lib/logger'

export const VISION_IMAGE_MAX_SIDE = 1024
const VISION_IMAGE_FETCH_TIMEOUT_MS = 8_000
const VISION_IMAGE_MAX_BYTES = 20 * 1024 * 1024

/**
 * Downscale an observation photo before sending it to the vision model
 * (long side ~1024px, JPEG). Fewer image tokens -> noticeably faster calls.
 * Any failure falls back to the original URL so identification still runs.
 */
export async function prepareVisionImageUrl(
  imageUrl: string,
  options: { maxSide?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (!/^https?:\/\//i.test(imageUrl)) return imageUrl
  const maxSide = options.maxSide ?? VISION_IMAGE_MAX_SIDE
  const fetchImpl = options.fetchImpl ?? fetch

  try {
    const response = await fetchImpl(imageUrl, { signal: AbortSignal.timeout(VISION_IMAGE_FETCH_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`image fetch ${response.status}`)
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > VISION_IMAGE_MAX_BYTES) throw new Error('image too large')
    const input = Buffer.from(await response.arrayBuffer())
    if (input.byteLength > VISION_IMAGE_MAX_BYTES) throw new Error('image too large')

    const { default: sharp } = await import('sharp')
    const output = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${output.toString('base64')}`
  } catch (error) {
    logger.warn('Vision image downscale failed; using original URL', {
      error: error instanceof Error ? error.message : String(error),
    })
    return imageUrl
  }
}

/**
 * Server-side file validation: magic bytes, size limits, MIME types.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
] as const

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number]

export const BUCKET_CONFIG: Record<string, { maxSizeMB: number; label: string }> = {
  avatars: { maxSizeMB: 2, label: '头像' },
  'comment-images': { maxSizeMB: 2, label: '评论图片' },
  'project-images': { maxSizeMB: 5, label: '项目图片' },
  'project-completions': { maxSizeMB: 10, label: '完成证明' },
  'project-completion-videos': { maxSizeMB: 30, label: '完成作品视频' },
}

export const ALLOWED_BUCKETS = Object.keys(BUCKET_CONFIG)

/**
 * Detect actual file format by reading magic bytes from an ArrayBuffer.
 * Supports images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM).
 */
export function detectMimeFromBytes(buffer: ArrayBuffer): AllowedMimeType | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) return null

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }

  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  // MP4: bytes 4-7 = "ftyp"
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    return 'video/mp4'
  }

  // WebM/Matroska: 1A 45 DF A3
  if (
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  ) {
    return 'video/webm'
  }

  return null
}

/**
 * Validate an image upload buffer against bucket constraints.
 * Only accepts image MIME types.
 */
export function validateUpload(
  buffer: ArrayBuffer,
  bucket: string,
): { error: string } | { mime: AllowedImageMimeType } {
  const config = BUCKET_CONFIG[bucket]
  if (!config) {
    return { error: `不允许的存储桶: ${bucket}` }
  }

  const maxBytes = config.maxSizeMB * 1024 * 1024
  if (buffer.byteLength > maxBytes) {
    return { error: `文件大小不能超过 ${config.maxSizeMB}MB` }
  }

  const mime = detectMimeFromBytes(buffer)
  if (!mime || !ALLOWED_IMAGE_MIME_TYPES.includes(mime as AllowedImageMimeType)) {
    return { error: '不支持的文件格式，仅允许 JPG、PNG、GIF、WebP' }
  }

  return { mime: mime as AllowedImageMimeType }
}

/**
 * Validate a video upload buffer. Only accepts video MIME types.
 */
export function validateVideoUpload(
  buffer: ArrayBuffer,
): { error: string } | { mime: AllowedVideoMimeType } {
  const config = BUCKET_CONFIG['project-completion-videos']
  const maxBytes = config.maxSizeMB * 1024 * 1024

  if (buffer.byteLength > maxBytes) {
    return { error: `视频大小不能超过 ${config.maxSizeMB}MB` }
  }

  const mime = detectMimeFromBytes(buffer)
  if (!mime || !ALLOWED_VIDEO_MIME_TYPES.includes(mime as AllowedVideoMimeType)) {
    return { error: '不支持的视频格式，仅允许 MP4、WebM' }
  }

  return { mime: mime as AllowedVideoMimeType }
}

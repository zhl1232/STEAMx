/**
 * Server-side file validation: magic bytes, size limits, MIME types.
 */

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const BUCKET_CONFIG: Record<string, { maxSizeMB: number; label: string }> = {
  avatars: { maxSizeMB: 2, label: '头像' },
  'comment-images': { maxSizeMB: 2, label: '评论图片' },
  'project-images': { maxSizeMB: 5, label: '项目图片' },
  'project-completions': { maxSizeMB: 10, label: '完成证明' },
}

export const ALLOWED_BUCKETS = Object.keys(BUCKET_CONFIG)

/**
 * Detect actual image format by reading magic bytes from an ArrayBuffer.
 * Returns the detected MIME type or null if unrecognized.
 */
export function detectMimeFromBytes(buffer: ArrayBuffer): AllowedMimeType | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4) return null

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

  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Validate a file buffer against bucket constraints.
 * Returns an error message or null if valid.
 */
export function validateUpload(
  buffer: ArrayBuffer,
  bucket: string,
): { error: string } | { mime: AllowedMimeType } {
  const config = BUCKET_CONFIG[bucket]
  if (!config) {
    return { error: `不允许的存储桶: ${bucket}` }
  }

  const maxBytes = config.maxSizeMB * 1024 * 1024
  if (buffer.byteLength > maxBytes) {
    return { error: `文件大小不能超过 ${config.maxSizeMB}MB` }
  }

  const mime = detectMimeFromBytes(buffer)
  if (!mime) {
    return { error: '不支持的文件格式，仅允许 JPG、PNG、GIF、WebP' }
  }

  return { mime }
}

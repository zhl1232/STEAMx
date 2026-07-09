import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import {
  COMPRESSION_PRESETS,
  ImageCompressionError,
  compressImageForBucket,
} from '@/lib/utils/image-compression'

async function maybeCompressForBucket(file: File, bucket: string): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (!COMPRESSION_PRESETS[bucket]) return file
  return compressImageForBucket(file, bucket)
}

export class SecureUploadError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message)
    this.name = 'SecureUploadError'
    this.status = options.status
    this.code = options.code
  }
}

function normalizeErrorPayload(data: unknown, fallback: string): { message: string; code?: string } {
  if (!data || typeof data !== 'object') {
    return { message: fallback }
  }

  const payload = data as Record<string, unknown>
  return {
    message: typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback,
    code: typeof payload.code === 'string' ? payload.code : undefined,
  }
}

async function readUploadError(res: Response): Promise<{ message: string; code?: string }> {
  const fallback = `上传失败（${res.status}）`
  const data = await res.json().catch(() => null)
  return normalizeErrorPayload(data, fallback)
}

export function getSecureUploadErrorMessage(error: unknown, fallback = '图片上传失败，请重试'): string {
  if (error instanceof SecureUploadError || error instanceof ImageCompressionError) {
    return error.message
  }

  return fallback
}

export function isExpectedSecureUploadRejection(error: unknown): boolean {
  return error instanceof SecureUploadError && !!error.status && error.status >= 400 && error.status < 500
}

/**
 * Upload via the server-side /api/upload endpoint.
 * Performs magic-bytes validation and size checks on the server.
 * Image files are automatically compressed client-side based on the target bucket.
 */
export async function uploadFileSecure(
  file: File,
  bucket: string,
  pathPrefix?: string
): Promise<string | null> {
  const prepared = await maybeCompressForBucket(file, bucket)

  const formData = new FormData()
  formData.append('file', prepared)
  formData.append('bucket', bucket)
  if (pathPrefix) {
    formData.append('pathPrefix', pathPrefix)
  }

  const res = await fetch('/api/upload', { method: 'POST', body: formData })

  if (!res.ok) {
    const { message, code } = await readUploadError(res)
    throw new SecureUploadError(message, { status: res.status, code })
  }

  const data = await res.json().catch(() => null)
  if (typeof data?.publicUrl === 'string') {
    return data.publicUrl
  }

  throw new SecureUploadError('图片上传失败，请重试', { status: res.status })
}

/**
 * Upload via /api/upload with XMLHttpRequest for progress tracking.
 * Image files are automatically compressed client-side before upload starts.
 * The onProgress callback only reflects XHR upload progress (not compression).
 */
export function uploadFileSecureWithProgress(
  file: File,
  bucket: string,
  onProgress?: (loaded: number, total: number) => void,
  pathPrefix?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    maybeCompressForBucket(file, bucket)
      .then((prepared) => {
        const formData = new FormData()
        formData.append('file', prepared)
        formData.append('bucket', bucket)
        if (pathPrefix) {
          formData.append('pathPrefix', pathPrefix)
        }

        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/upload')

        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded, e.total)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve(data.publicUrl ?? null)
            } catch {
              resolve(null)
            }
          } else {
            logger.error('Upload with progress failed', { status: xhr.status })
            resolve(null)
          }
        }

        xhr.onerror = () => {
          logger.error('Upload XHR error')
          resolve(null)
        }

        xhr.send(formData)
      })
      .catch((error) => {
        if (error instanceof ImageCompressionError) {
          logger.error('Image compression rejected upload', { error: error.message, bucket })
        } else {
          logger.error('Pre-upload compression failed', { error, bucket })
        }
        resolve(null)
      })
  })
}

/**
 * 上传文件到 Supabase Storage (legacy, client-direct)
 * @deprecated Use uploadFileSecure for server-validated uploads
 */
export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      logger.error('File upload error', { error })
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    logger.error('Unexpected error during file upload', { error })
    return null
  }
}

/**
 * 删除 Supabase Storage 中的文件
 * @param bucket - 存储桶名称
 * @param path - 文件路径
 * @returns 删除是否成功
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<boolean> {
  try {
    const supabase = createClient()

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      logger.error('File deletion error', { error })
      return false
    }

    return true
  } catch (error) {
    logger.error('Unexpected error during file deletion', { error })
    return false
  }
}

/**
 * 生成唯一的文件路径
 * @param userId - 用户ID
 * @param fileName - 原始文件名
 * @param prefix - 路径前缀（例如：'projects', 'steps'）
 * @returns 唯一的文件路径
 */
export function generateFilePath(
  userId: string,
  fileName: string,
  prefix: string = 'projects'
): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 9)
  const extension = fileName.split('.').pop()
  return `${prefix}/${userId}/${timestamp}-${randomStr}.${extension}`
}

/**
 * 验证文件类型
 * @param file - 要验证的文件
 * @param allowedTypes - 允许的MIME类型数组
 * @returns 是否为允许的文件类型
 */
export function validateFileType(
  file: File,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
): boolean {
  return allowedTypes.includes(file.type)
}

/**
 * 验证文件大小
 * @param file - 要验证的文件
 * @param maxSizeMB - 最大文件大小（MB）
 * @returns 是否符合大小限制
 */
export function validateFileSize(
  file: File,
  maxSizeMB: number = 5
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

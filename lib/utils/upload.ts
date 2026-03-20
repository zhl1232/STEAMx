import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

/**
 * Upload via the server-side /api/upload endpoint.
 * Performs magic-bytes validation and size checks on the server.
 */
export async function uploadFileSecure(
  file: File,
  bucket: string,
  pathPrefix?: string
): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    if (pathPrefix) {
      formData.append('pathPrefix', pathPrefix)
    }

    const res = await fetch('/api/upload', { method: 'POST', body: formData })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const msg = data?.error || `Upload failed (${res.status})`
      logger.error('Secure upload error', { error: msg, bucket })
      throw new Error(msg)
    }

    const data = await res.json()
    return data.publicUrl ?? null
  } catch (error) {
    logger.error('Unexpected error during secure upload', { error })
    return null
  }
}

/**
 * Upload via /api/upload with XMLHttpRequest for progress tracking.
 * Falls back to uploadFileSecure on XHR failure.
 */
export function uploadFileSecureWithProgress(
  file: File,
  bucket: string,
  onProgress?: (loaded: number, total: number) => void,
  pathPrefix?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const formData = new FormData()
    formData.append('file', file)
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

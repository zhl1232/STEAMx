import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

/**
 * 上传文件到 Supabase Storage
 * @param file - 要上传的文件
 * @param bucket - 存储桶名称
 * @param path - 文件路径（相对于bucket）
 * @returns 上传成功后的公开URL，失败返回null
 */
export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    const supabase = createClient()

    // 上传文件
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

    // 获取公开URL
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

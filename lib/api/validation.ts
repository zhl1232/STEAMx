import { checkContent } from '@/lib/content-filter'

/**
 * 验证错误类
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * 验证必填字符串
 * @param value 待验证的值
 * @param fieldName 字段名称
 * @param maxLength 最大长度（可选）
 * @throws ValidationError 如果验证失败
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  maxLength?: number
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`)
  }

  const trimmed = value.trim()

  if (maxLength && trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} characters`
    )
  }

  return trimmed
}

/**
 * 验证枚举值
 * @param value 待验证的值
 * @param fieldName 字段名称
 * @param allowedValues 允许的值列表
 * @throws ValidationError 如果验证失败
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    )
  }
  return value as T
}

/**
 * 验证可选字符串
 * @param value 待验证的值
 * @param fieldName 字段名称
 * @param maxLength 最大长度（可选）
 * @returns 验证后的字符串或 undefined
 * @throws ValidationError 如果验证失败
 */
export function validateOptionalString(
  value: unknown,
  fieldName: string,
  maxLength?: number
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`)
  }

  const trimmed = value.trim()

  if (maxLength && trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} characters`
    )
  }

  return trimmed
}

/**
 * 验证数组
 * @param value 待验证的值
 * @param fieldName 字段名称
 * @param maxLength 最大长度（可选）
 * @throws ValidationError 如果验证失败
 */
export function validateArray<T = unknown>(
  value: unknown,
  fieldName: string,
  maxLength?: number
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`)
  }

  if (maxLength && value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not contain more than ${maxLength} items`
    )
  }

  return value as T[]
}

/**
 * 验证 URL
 * @param value 待验证的值
 * @param fieldName 字段名称
 * @throws ValidationError 如果验证失败
 */
export function validateUrl(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`)
  }

  try {
    new URL(value)
    return value
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`)
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 验证 UUID 格式
 * @throws ValidationError 如果不是合法 UUID
 */
export function validateUUID(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`)
  }
  return value
}

/**
 * 验证数字范围
 * @throws ValidationError 如果不在范围内
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  opts?: { min?: number; max?: number; integer?: boolean }
): number {
  const num = typeof value === 'string' ? Number(value) : value
  if (typeof num !== 'number' || Number.isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`)
  }
  if (opts?.integer && !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`)
  }
  if (opts?.min !== undefined && num < opts.min) {
    throw new ValidationError(`${fieldName} must be at least ${opts.min}`)
  }
  if (opts?.max !== undefined && num > opts.max) {
    throw new ValidationError(`${fieldName} must be at most ${opts.max}`)
  }
  return num
}

/**
 * 验证日期时间字符串可被解析
 * @throws ValidationError 如果不是合法日期时间
 */
export function validateDateTimeString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a valid datetime`)
  }

  const trimmed = value.trim()
  if (Number.isNaN(Date.parse(trimmed))) {
    throw new ValidationError(`${fieldName} must be a valid datetime`)
  }

  return trimmed
}

/**
 * 验证文本不含敏感词
 * @throws ValidationError 如果文本中检测到敏感词
 */
export function validateContentSafe(value: string, fieldName: string): string {
  const result = checkContent(value)
  if (!result.passed) {
    throw new ValidationError(`${fieldName}包含不当内容，请修改后重试`)
  }
  return value
}

/**
 * 验证评论/回复图片 URL 是否属于指定用户的 Supabase Storage 路径
 * 防止通过任意外部域名绕过所有权校验
 */
export function isOwnedCommentImageUrl(imageUrl: string, userId: string): boolean {
  const expectedPath = `/storage/v1/object/public/comment-images/${userId}/`

  if (imageUrl.startsWith('/')) {
    return imageUrl.startsWith(expectedPath)
  }

  try {
    const parsed = new URL(imageUrl)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const expected = new URL(supabaseUrl)
      if (parsed.hostname !== expected.hostname) return false
    }
    return parsed.pathname.startsWith(expectedPath)
  } catch {
    return false
  }
}

type OwnedProjectImageOptions = {
  /** Storage bucket，默认 project-images；完成作品图为 project-completions */
  bucket?: string
  /** bucket 内的子目录，如 observations */
  pathPrefix?: string
}

export function isOwnedProjectImageUrl(
  imageUrl: string,
  userId: string,
  pathPrefixOrOptions?: string | OwnedProjectImageOptions,
): boolean {
  const options: OwnedProjectImageOptions =
    typeof pathPrefixOrOptions === 'string'
      ? { pathPrefix: pathPrefixOrOptions }
      : pathPrefixOrOptions ?? {}

  const bucket = options.bucket ?? 'project-images'
  let pathname = imageUrl

  if (!imageUrl.startsWith('/')) {
    try {
      const parsed = new URL(imageUrl)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl) {
        const expected = new URL(supabaseUrl)
        if (parsed.hostname !== expected.hostname) return false
      }
      pathname = parsed.pathname
    } catch {
      return false
    }
  }

  const objectPrefix = `/storage/v1/object/public/${bucket}/`
  const renderPrefix = `/storage/v1/render/image/public/${bucket}/`

  let relativePath: string | null = null
  if (pathname.startsWith(objectPrefix)) {
    relativePath = pathname.slice(objectPrefix.length)
  } else if (pathname.startsWith(renderPrefix)) {
    relativePath = pathname.slice(renderPrefix.length)
  }

  if (!relativePath) {
    return false
  }

  const expectedPrefix = options.pathPrefix ? `${options.pathPrefix}/${userId}/` : `${userId}/`
  return relativePath.startsWith(expectedPrefix)
}

export function isOwnedCompletionVideoUrl(videoUrl: string, userId: string): boolean {
  return isOwnedProjectImageUrl(videoUrl, userId, { bucket: 'project-completion-videos' })
}

const TRUSTED_LOCAL_ASSET_PREFIXES = [
  '/avatars/',
  '/projects/',
  '/birds/',
  '/trees/',
  '/insects/',
  '/assets/',
]

export function isTrustedLocalAssetUrl(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  return TRUSTED_LOCAL_ASSET_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function validateOwnedOrTrustedProjectImageUrl(
  imageUrl: string | null | undefined,
  userId: string,
  fieldName: string,
  pathPrefixOrOptions?: string | OwnedProjectImageOptions,
): void {
  if (!imageUrl) return
  if (isTrustedLocalAssetUrl(imageUrl)) return
  if (isOwnedProjectImageUrl(imageUrl, userId, pathPrefixOrOptions)) return
  throw new ValidationError(`${fieldName}必须使用当前账号上传的文件`)
}

export function validateContentSafeIfPresent(
  value: string | null | undefined,
  fieldName: string,
): void {
  if (typeof value === 'string' && value.trim().length > 0) {
    validateContentSafe(value, fieldName)
  }
}

/**
 * 清理和限制搜索字符串
 * @param search 搜索字符串
 * @param maxLength 最大长度（默认 50）
 * @returns 清理后的搜索字符串
 */
export function sanitizeSearch(search: string, maxLength: number = 50): string {
  // 移除特殊字符，只保留字母、数字、空格、中文和基本标点
  const sanitized = search
    .trim()
    .slice(0, maxLength)
    .replace(/[^\w\s\u4e00-\u9fa5.-]/g, '')

  return sanitized
}

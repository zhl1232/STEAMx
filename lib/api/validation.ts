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

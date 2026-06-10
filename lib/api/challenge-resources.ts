import { ValidationError } from '@/lib/api/validation'
import { CHALLENGE_RESOURCE_TYPES, type ChallengeResource } from '@/lib/mappers/types'

/**
 * 校验挑战 resources 字段：每条必须有 title / url / 三分类 type，
 * description 可选。返回清洗后的数组。
 */
export function validateChallengeResources(raw: unknown): ChallengeResource[] {
  if (raw === undefined || raw === null) return []

  if (!Array.isArray(raw)) {
    throw new ValidationError('resources must be an array')
  }

  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`resources[${index}] must be an object`)
    }

    const { title, url, type, description } = item as Record<string, unknown>

    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 120) {
      throw new ValidationError(`resources[${index}].title is required (max 120 chars)`)
    }

    if (typeof url !== 'string' || url.trim().length === 0 || url.length > 500) {
      throw new ValidationError(`resources[${index}].url is required (max 500 chars)`)
    }

    if (!CHALLENGE_RESOURCE_TYPES.includes(type as never)) {
      throw new ValidationError(
        `resources[${index}].type must be one of: ${CHALLENGE_RESOURCE_TYPES.join(', ')}`
      )
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw new ValidationError(`resources[${index}].description must be a string`)
    }

    const trimmedDescription = typeof description === 'string' ? description.trim() : ''

    return {
      title: title.trim(),
      url: url.trim(),
      type: type as ChallengeResource['type'],
      ...(trimmedDescription ? { description: trimmedDescription.slice(0, 200) } : {}),
    }
  })
}

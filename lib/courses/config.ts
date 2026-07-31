export const COURSE_STEAM_DIMENSIONS = ['S', 'T', 'E', 'A', 'M'] as const

export type CourseSteamDimension = (typeof COURSE_STEAM_DIMENSIONS)[number]
export type CourseSteamWeights = Record<CourseSteamDimension, number>

export const DEFAULT_COURSE_STEAM_WEIGHTS: CourseSteamWeights = {
  S: 5,
  T: 35,
  E: 5,
  A: 15,
  M: 15,
}

export interface CourseConfigValidation {
  valid: boolean
  value: CourseSteamWeights | null
  error?: string
}

export function validateCourseSteamWeights(value: unknown): CourseConfigValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, value: null, error: 'steam_weights 必须是对象' }
  }

  const source = value as Record<string, unknown>
  const weights = {} as CourseSteamWeights
  let hasPositive = false

  for (const dimension of COURSE_STEAM_DIMENSIONS) {
    const weight = source[dimension]
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      return {
        valid: false,
        value: null,
        error: `steam_weights.${dimension} 必须是有限非负数`,
      }
    }
    weights[dimension] = weight
    hasPositive ||= weight > 0
  }

  if (!hasPositive) {
    return { valid: false, value: null, error: 'steam_weights 至少需要一项大于 0' }
  }

  return { valid: true, value: weights }
}

export function normalizeCourseSteamWeights(value: unknown): CourseSteamWeights | null {
  return validateCourseSteamWeights(value).value
}

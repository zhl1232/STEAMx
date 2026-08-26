import type {
  ClassificationSource,
  ClassificationStatus,
  ContentType,
  DifficultyBand,
  EducationStage,
  SupportLevel,
} from './types'

export const CONTENT_CLASSIFICATION_VERSION = 'CONTENT_CLASSIFICATION_V1'

export const MIN_RECOMMENDED_AGE = 3
export const MAX_RECOMMENDED_AGE = 16
export const MIN_DIFFICULTY_STARS = 1
export const MAX_DIFFICULTY_STARS = 6

export const CONTENT_TYPES = ['course', 'project', 'challenge'] as const satisfies readonly ContentType[]

export const DIFFICULTY_BANDS = ['beginner', 'intermediate', 'challenge'] as const satisfies readonly DifficultyBand[]
export const SUPPORT_LEVELS = ['independent', 'guided', 'adult_required'] as const satisfies readonly SupportLevel[]
export const CLASSIFICATION_STATUSES = ['unreviewed', 'reviewed'] as const satisfies readonly ClassificationStatus[]
export const CLASSIFICATION_SOURCES = ['rules_v1', 'manual'] as const satisfies readonly ClassificationSource[]
export const EDUCATION_STAGES = ['preschool', 'primary', 'junior', 'senior'] as const satisfies readonly EducationStage[]

/** 这些字段变化会使旧三轴结论失效。 */
export const CLASSIFICATION_INVALIDATION_FIELDS = [
  'title',
  'description',
  'content',
  'objective',
  'objectives',
  'constraints',
  'expected_outcome',
  'scenario',
  'driving_question',
  'materials',
  'project_materials',
  'steps',
  'project_steps',
  'stages',
  'resources',
  'course_lessons',
  'course_lesson',
  'difficulty_stars',
  'recommended_min_age',
  'recommended_max_age',
  'support_level',
] as const

/** 运营字段只改变展示/排序，不应使内容分级失效。 */
export const CLASSIFICATION_NON_INVALIDATING_FIELDS = [
  'image_url',
  'cover_image_url',
  'sort_order',
  'likes_count',
  'views_count',
  'comments_count',
  'participants_count',
  'completions_count',
  'updated_at',
] as const

export const CONTENT_CLASSIFICATION_SETTINGS_DEFAULTS = {
  publicV1Enabled: false,
  enforcementEnabled: false,
} as const

export const DIFFICULTY_BAND_LABELS: Record<DifficultyBand, string> = {
  beginner: '入门',
  intermediate: '进阶',
  challenge: '挑战',
}

export const SUPPORT_LEVEL_LABELS: Record<SupportLevel, string> = {
  independent: '可独立完成',
  guided: '建议成人陪同',
  adult_required: '需成人协助',
}

export const EDUCATION_STAGE_LABELS: Record<EducationStage, string> = {
  preschool: '学前',
  primary: '小学',
  junior: '初中',
  senior: '高中',
}

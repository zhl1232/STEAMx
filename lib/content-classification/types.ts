/**
 * 课程、项目与挑战共用的内容分级领域类型。
 *
 * 数据库字段使用 snake_case，进入领域层/API 后统一使用 camelCase。
 * difficulty_stars 仍然是内部历史字段，不属于公开 DTO。
 */

export type ContentType = 'course' | 'project' | 'challenge'

export type DifficultyBand = 'beginner' | 'intermediate' | 'challenge'

export type SupportLevel = 'independent' | 'guided' | 'adult_required'

export type ClassificationStatus = 'unreviewed' | 'reviewed'

export type ClassificationSource = 'rules_v1' | 'manual'

export type EducationStage = 'preschool' | 'primary' | 'junior' | 'senior'

export type ClassificationDecision = 'approve' | 'return'

export interface ContentClassificationRow {
  recommended_min_age: number | null
  recommended_max_age: number | null
  support_level: string | null
  classification_status: string | null
  classification_source: string | null
  classification_reviewed_at: string | null
  classification_reviewed_by: string | null
  classification_revision: number | null
  difficulty_stars: number | null
}

export interface ContentClassification {
  recommendedMinAge: number | null
  recommendedMaxAge: number | null
  difficultyBand: DifficultyBand | null
  supportLevel: SupportLevel | null
  status: ClassificationStatus
  source: ClassificationSource | null
  reviewedAt: string | null
  reviewedBy: string | null
  revision: number
}

/** 公开内容的完整三轴；只有 reviewed 且完整时才允许生成。 */
export interface PublicClassification {
  recommendedMinAge: number
  recommendedMaxAge: number | null
  ageLabel: string
  difficultyBand: DifficultyBand
  difficultyLabel: string
  supportLevel: SupportLevel
  supportLabel: string
  educationStage: EducationStage
  educationStageLabel: string
  status: 'reviewed'
}

/** 阶段一未复核内容明确返回 classification: null。 */
export interface PublicClassificationEnvelope {
  classification: PublicClassification | null
}

export interface AdminClassification extends ContentClassification {
  difficultyStars: number | null
  candidateReason?: string | null
  safetyKeywords?: string[]
}

export interface ClassificationInput {
  recommendedMinAge: number | null
  recommendedMaxAge: number | null
  supportLevel: SupportLevel | null
  difficultyStars: number | null
}

export interface ClassificationReviewInput extends ClassificationInput {
  decision: ClassificationDecision
  note?: string | null
  idempotencyKey: string
}

export interface ClassificationValidationResult {
  valid: boolean
  errors: string[]
}

export interface ContentChangeSet {
  /** 发生变化的数据库字段或应用层逻辑字段。 */
  changedFields: Iterable<string>
}

export interface ClassificationCandidateSource {
  title?: string | null
  description?: string | null
  tags?: string[] | null
  materials?: string[] | null
  scenario?: string | null
  driving_question?: string | null
  expected_outcome?: string | null
  constraints?: unknown
  resources?: unknown
  stages?: unknown
  steps?: Array<{ title?: string | null; description?: string | null }> | null
  project_materials?: unknown
  project_steps?: unknown
  course_lessons?: unknown
  metadata?: Record<string, unknown> | null
  difficultyStars?: number | null
  difficulty?: string | null
}

export interface ClassificationCandidate {
  recommendedMinAge: number | null
  recommendedMaxAge: number | null
  supportLevel: SupportLevel | null
  difficultyStars: number | null
  difficultyBand: DifficultyBand | null
  source: 'rules_v1'
  status: 'unreviewed'
  confidence: 'high' | 'medium' | 'low'
  matchedRules: string[]
  safetyKeywords: string[]
}

export interface ClassificationJsonLdFields {
  typicalAgeRange: string
  educationalLevel: string
}

export interface PublicClassificationSettings {
  publicV1Enabled: boolean
  enforcementEnabled: boolean
}

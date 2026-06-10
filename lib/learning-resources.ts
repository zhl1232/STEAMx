/**
 * 学习资料卡（learning_resources）共享常量与类型。
 *
 * 资料卡是 PBL 挑战脚手架（参考项目 / 前置技能 / 资料卡）中
 * 「资料卡」的内容载体，可跨挑战复用；站内缺少对应项目或课程时，
 * 也可用 skill / case 类资料卡兜底。
 */

export const LEARNING_RESOURCE_CATEGORIES = [
  'principle',
  'material',
  'method',
  'skill',
  'case',
] as const

export type LearningResourceCategory = (typeof LEARNING_RESOURCE_CATEGORIES)[number]

export const LEARNING_RESOURCE_CATEGORY_LABELS: Record<LearningResourceCategory, string> = {
  principle: '原理',
  material: '材料',
  method: '方法',
  skill: '技能',
  case: '案例',
}

export const LEARNING_RESOURCE_STATUSES = ['draft', 'published'] as const

export type LearningResourceStatus = (typeof LEARNING_RESOURCE_STATUSES)[number]

export interface LearningResource {
  id: number
  title: string
  summary?: string
  contentMd: string
  category: LearningResourceCategory
  coverImageUrl?: string
  status: LearningResourceStatus
  createdAt: string
  updatedAt: string
}

export function learningResourcePath(id: number): string {
  return `/resources/${id}`
}

interface LearningResourceRow {
  id: number
  title: string
  summary: string | null
  content_md: string
  category: string
  cover_image_url: string | null
  status: string
  created_at: string
  updated_at: string
}

export function mapLearningResource(row: LearningResourceRow): LearningResource {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || undefined,
    contentMd: row.content_md,
    category: row.category as LearningResourceCategory,
    coverImageUrl: row.cover_image_url || undefined,
    status: row.status as LearningResourceStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

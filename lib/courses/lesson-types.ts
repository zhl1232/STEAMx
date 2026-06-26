export type LessonTypeSlug = string

export type LessonTypeDefinition = {
  slug: LessonTypeSlug
  label: string
  description: string
  workspace: 'scratch' | 'building_3d' | 'playground' | 'unsupported'
}

export const LESSON_TYPE_SLUG_PATTERN = /^[a-z][a-z0-9_]{1,31}$/

export const LESSON_TYPE_DEFINITIONS = [
  {
    slug: 'scratch',
    label: 'Scratch 编程',
    description: '使用 Scratch 编辑器完成互动作品。',
    workspace: 'scratch',
  },
  {
    slug: 'building_3d',
    label: '大颗粒积木搭建',
    description: '使用 3D 图纸和零件清单完成实体搭建。',
    workspace: 'building_3d',
  },
  {
    slug: 'playground',
    label: '游乐场实训',
    description: '在游乐场游戏中完成挑战，配套分步讲解与实战入口。',
    workspace: 'playground',
  },
  {
    slug: 'reading',
    label: '阅读资料',
    description: '以阅读和记录为主的课时。',
    workspace: 'unsupported',
  },
  {
    slug: 'video',
    label: '视频课',
    description: '以视频讲解为主的课时。',
    workspace: 'unsupported',
  },
  {
    slug: 'quiz',
    label: '测验',
    description: '以问题检查和反馈为主的课时。',
    workspace: 'unsupported',
  },
] as const satisfies readonly LessonTypeDefinition[]

export const LESSON_TYPE_OPTIONS = LESSON_TYPE_DEFINITIONS.map((type) => ({
  value: type.slug,
  label: type.label,
  description: type.description,
}))

export function isValidLessonTypeSlug(value: unknown): value is LessonTypeSlug {
  return typeof value === 'string' && LESSON_TYPE_SLUG_PATTERN.test(value)
}

export function getLessonTypeDefinition(slug: string | null | undefined): LessonTypeDefinition {
  return (
    LESSON_TYPE_DEFINITIONS.find((definition) => definition.slug === slug) ?? {
      slug: slug && isValidLessonTypeSlug(slug) ? slug : 'unknown',
      label: '暂不支持的课时',
      description: '这个课时类型尚未接入学习工作区。',
      workspace: 'unsupported',
    }
  )
}

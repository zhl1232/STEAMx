import type { LessonTypeSlug } from '@/lib/courses/lesson-types'

export type CourseStatus = 'draft' | 'approved' | 'archived'
export type LessonType = LessonTypeSlug

export interface CourseLessonStep {
  title: string
  description: string
  hint?: string
  checklist?: string[]
}

export interface CourseLessonResource {
  title: string
  url: string
  type?: string
}

/** 完成课时的一条积木校验规则：作品里只要用到 anyOf 中任一 opcode 即算达成 */
export interface LessonRequiredBlock {
  /** 给孩子看的中文积木名，如「重复执行」「当角色被点击」 */
  label: string
  /** Scratch 3 标准 opcode 列表，满足其一即可 */
  anyOf: string[]
}

export interface LessonContent {
  /** 一句话课程目标，展示在侧边栏 */
  summary?: string
  /** 本课对应的 Scratch 官方教程 deck id（如 'tell-a-story'、'pong-game'），用于「教程」按钮按课直达 */
  tutorialDeckId?: string
  /** 完成本课必须用到的关键积木；为空或缺省时退化为「保存即可完成」 */
  requiredBlocks?: LessonRequiredBlock[]
  /** 3D 搭建课内容；仅 lesson_type=building_3d 时由搭建工作区读取 */
  building3d?: Building3DLessonContent
  [key: string]: unknown
}

export interface Building3DPart {
  id: string
  name: string
  color: string
  quantity: number
}

export interface Building3DStep {
  title: string
  description: string
  partIds: string[]
  highlightNodeIds?: string[]
  cameraHint?: 'front' | 'side' | 'top' | 'isometric'
}

export interface Building3DLessonContent {
  modelUrl?: string
  parts: Building3DPart[]
  steps3d: Building3DStep[]
}

export interface CourseRow {
  id: number
  title: string
  description: string | null
  image_url: string | null
  tags: string[] | null
  difficulty_stars: number
  status: CourseStatus
  sort_order: number
  steam_weights: Record<string, number> | null
  created_at: string
  updated_at: string
}

export interface CourseLessonRow {
  id: number
  course_id: number
  title: string
  lesson_type: LessonType
  content: LessonContent | null
  steps: CourseLessonStep[]
  resources: CourseLessonResource[]
  starter_project_path: string | null
  sort_order: number
  duration_minutes: number | null
  created_at: string
  updated_at: string
}

export interface CourseListItem extends CourseRow {
  lesson_count: number
}

export interface CourseDetail extends CourseRow {
  lessons: CourseLessonRow[]
}

export interface UserLessonProgressRow {
  user_id: string
  lesson_id: number
  scratch_project_path: string | null
  completed_at: string | null
  updated_at: string
}

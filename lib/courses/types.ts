export type CourseStatus = 'draft' | 'approved' | 'archived'
export type LessonType = 'scratch' | 'reading' | 'video' | 'quiz'

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
  content: Record<string, unknown> | null
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

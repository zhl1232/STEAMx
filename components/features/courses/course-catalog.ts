import type { CourseListItem } from '@/lib/courses/types'

export type CourseCategory = 'brick' | 'programming' | 'strategy' | 'other'
export type CourseFilter = 'recommended' | 'all' | 'learning' | CourseCategory
export const COURSE_CATEGORY_LABELS: Record<CourseCategory, string> = {
  brick: '积木搭建', programming: '编程', strategy: '思维与策略', other: '其他技能',
}
const BRICK_COURSE_TAGS = new Set(['积木', '乐高', '得宝', 'building_3d'])

export function isBrickCourse(course: Pick<CourseListItem, 'tags'>) {
  return (course.tags ?? []).some(tag => BRICK_COURSE_TAGS.has(tag.trim().toLowerCase()))
}

export function partitionCourseGroups(courses: readonly CourseListItem[]) {
  return courses.reduce((groups, course) => {
    groups[isBrickCourse(course) ? 'brick' : 'other'].push(course)
    return groups
  }, { brick: [] as CourseListItem[], other: [] as CourseListItem[] })
}

/** 仅按现有名称/标签归类；分类不推断年龄、难度或零件兼容性。 */
export function getCourseCategory(course: CourseListItem): CourseCategory {
  const text = [course.title, ...(course.tags ?? [])].join(' ')
  if (/scratch|python|编程|programming/i.test(text)) return 'programming'
  if (isBrickCourse(course)) return 'brick'
  if (/五子棋|围棋|象棋|国际象棋|棋类|gomoku|chess/i.test(text)) return 'strategy'
  return 'other'
}

export function isLearningCourse(course: CourseListItem) {
  return course.lesson_count > 0 && course.progress?.status === 'in_progress'
    && course.progress.total_lesson_count > 0
}

export function getCourseAction(course: CourseListItem) {
  const overview = `/courses/${course.id}`
  if (course.lesson_count === 0) return { label: '查看课程', href: overview }
  if (course.progress?.status === 'completed') return { label: '回顾课程', href: overview }
  if (isLearningCourse(course)) {
    const next = course.progress?.next_lesson_id
    return { label: '继续学习', href: next && next > 0 ? `${overview}/lessons/${next}` : overview }
  }
  return { label: '开始学习', href: overview }
}

/** 推荐沿用接口顺序，并优先积木；不把数组首项宣称为最近学习。 */
export function selectCourseCatalog(courses: readonly CourseListItem[], filter: CourseFilter) {
  if (filter === 'learning') return courses.filter(isLearningCourse)
  if (filter !== 'recommended' && filter !== 'all') return courses.filter(course => getCourseCategory(course) === filter)
  if (filter === 'all') return [...courses]
  const brick = courses.filter(course => getCourseCategory(course) === 'brick')
  return [...brick, ...courses.filter(course => getCourseCategory(course) !== 'brick')]
}

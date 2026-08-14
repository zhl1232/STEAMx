import type {
  CourseCompletionState,
  CourseLessonSummary,
  CourseProgressStatus,
  CourseProgressSummary,
} from '@/lib/courses/types'

type ProgressLesson = Pick<CourseLessonSummary, 'id' | 'sort_order'>

export interface CourseProgressApiSummary {
  completedLessonCount: number
  totalLessonCount: number
  status: CourseProgressStatus
  nextLessonId: number | null
  milestoneCompletedAt: string | null
}

export interface LessonCompletionFeedback {
  title: string
  description?: string
  /** 整门课刚学完时带上结课凭证入口，否则学员只看到一句 toast 就没了 */
  certificateHref?: string
}

function compareLessons(left: ProgressLesson, right: ProgressLesson) {
  return left.sort_order - right.sort_order || left.id - right.id
}

export function deriveCourseProgress(
  lessons: readonly ProgressLesson[],
  completedIds: Iterable<number>,
  milestoneCompletedAt: string | null = null,
): CourseProgressSummary {
  const orderedLessons = [...lessons].sort(compareLessons)
  const lessonIds = new Set(orderedLessons.map((lesson) => lesson.id))
  const completed = new Set(completedIds)
  const completedLessonCount = orderedLessons.reduce(
    (count, lesson) => count + (completed.has(lesson.id) ? 1 : 0),
    0,
  )
  const totalLessonCount = orderedLessons.length
  const status: CourseProgressStatus =
    totalLessonCount === 0
      ? 'not_started'
      : completedLessonCount === 0
        ? 'not_started'
        : completedLessonCount === totalLessonCount
          ? 'completed'
          : 'in_progress'

  const nextLessonId =
    status === 'completed'
      ? null
      : orderedLessons.find((lesson) => !completed.has(lesson.id))?.id ?? null

  return {
    completed_lesson_count: completedLessonCount,
    total_lesson_count: totalLessonCount,
    status,
    next_lesson_id: nextLessonId,
    milestone_completed_at: lessonIds.size > 0 ? milestoneCompletedAt : null,
  }
}

export function toCourseProgressApi(
  progress: CourseProgressSummary,
): CourseProgressApiSummary {
  return {
    completedLessonCount: progress.completed_lesson_count,
    totalLessonCount: progress.total_lesson_count,
    status: progress.status,
    nextLessonId: progress.next_lesson_id,
    milestoneCompletedAt: progress.milestone_completed_at,
  }
}

export function fromCourseProgressApi(
  progress: CourseProgressApiSummary | null | undefined,
): CourseProgressSummary | null {
  if (!progress) return null

  return {
    completed_lesson_count: progress.completedLessonCount,
    total_lesson_count: progress.totalLessonCount,
    status: progress.status,
    next_lesson_id: progress.nextLessonId,
    milestone_completed_at: progress.milestoneCompletedAt,
  }
}

export function getLessonCompletionFeedback(args: {
  alreadyCompleted?: boolean
  courseCompletionState?: CourseCompletionState
  courseId?: number
}): LessonCompletionFeedback {
  if (args.courseCompletionState === 'created') {
    return {
      title: '课程已完成',
      description: '整门课学完了，结课凭证和作品册已经生成',
      certificateHref: args.courseId ? `/courses/${args.courseId}/certificate` : undefined,
    }
  }

  if (args.courseCompletionState === 'configuration_error') {
    return { title: '课时进度已保存' }
  }

  if (args.alreadyCompleted || args.courseCompletionState === 'already_recorded') {
    return { title: '本课已完成' }
  }

  return { title: '课时进度已保存' }
}

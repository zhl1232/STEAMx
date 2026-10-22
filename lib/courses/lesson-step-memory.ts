/**
 * 积木课「记住上次看到第几页」：只存在本机浏览器，不写数据库。
 * 键按课时区分；读写失败（隐私模式、存储满）一律静默忽略。
 */
const KEY_PREFIX = 'steamx:lesson-step:'
const LAST_KEY = 'steamx:last-lesson'

export interface LastLessonVisit {
  courseId: number
  lessonId: number
  stepIndex: number
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function rememberLessonStep(lessonId: number, stepIndex: number, courseId?: number) {
  const store = storage()
  if (!store || !Number.isInteger(stepIndex) || stepIndex < 0) return
  try {
    store.setItem(`${KEY_PREFIX}${lessonId}`, String(stepIndex))
    if (courseId) {
      store.setItem(LAST_KEY, JSON.stringify({ courseId, lessonId, stepIndex } satisfies LastLessonVisit))
    }
  } catch {
    /* ignore */
  }
}

export function readRememberedLessonStep(lessonId: number): number | null {
  const raw = storage()?.getItem(`${KEY_PREFIX}${lessonId}`)
  if (!raw || !/^\d+$/.test(raw)) return null
  return Number(raw)
}

export function readLastLessonVisit(courseId?: number): LastLessonVisit | null {
  const raw = storage()?.getItem(LAST_KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<LastLessonVisit>
    if (!Number.isInteger(value.courseId) || !Number.isInteger(value.lessonId) || !Number.isInteger(value.stepIndex)) return null
    if (courseId && value.courseId !== courseId) return null
    return value as LastLessonVisit
  } catch {
    return null
  }
}

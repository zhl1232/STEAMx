import type { CourseLessonTrack, LessonContent } from '@/lib/courses/types'

export const COURSE_LESSON_TRACK_LABELS: Record<CourseLessonTrack, string> = {
  foundation: '基础必学',
  tactics: '战术进阶',
  ai: 'AI 原理',
  review: '复盘训练',
}

export function getLessonTrackLabel(content: LessonContent | null | undefined) {
  const override = typeof content?.levelLabel === 'string' ? content.levelLabel.trim() : ''
  if (override) return override

  const track = content?.track
  return track ? COURSE_LESSON_TRACK_LABELS[track] ?? null : null
}

import { pinyin } from 'pinyin-pro'

import {
  LESSON_CATALOG_OTHER_INITIAL,
  normalizeLessonQuery,
  toLessonInitial,
  type LessonCatalogItem,
} from '@/lib/courses/lesson-catalog'
import { getLessonTrackLabel } from '@/lib/courses/tracks'
import type { CourseLessonSummary, LessonType } from '@/lib/courses/types'

/**
 * 服务端专用：把课时摘要转成课时目录条目。
 * 依赖 pinyin-pro（带完整字典，约 300KB），必须留在服务端，
 * 客户端只消费 lesson-catalog.ts 里的纯过滤函数。
 */

const LESSON_TYPE_LABELS: Partial<Record<LessonType, string>> = {
  building_3d: '搭建',
  scratch: 'Scratch',
  playground: '实战',
}

/** 中文标题同时支持中文、全拼和首字母缩写三种输入：搜「恐龙」「konglong」「kl」都能命中 */
function buildSearchText(title: string, summary: string | null): string {
  const parts = [title, summary ?? '']
  if (/[\u3400-\u9fff]/.test(title)) {
    parts.push(pinyin(title, { toneType: 'none' }).replace(/\s+/g, ''))
    parts.push(pinyin(title, { pattern: 'first', toneType: 'none', type: 'array' }).join(''))
  }
  return parts.map(normalizeLessonQuery).filter(Boolean).join(' ')
}

function resolveInitial(title: string): string {
  if (!/[\u3400-\u9fff]/.test(title)) return toLessonInitial(title)
  const [first] = pinyin(title, { pattern: 'first', toneType: 'none', type: 'array' })
  return first ? toLessonInitial(first) : LESSON_CATALOG_OTHER_INITIAL
}

export function buildLessonCatalogItems(
  lessons: CourseLessonSummary[],
  options?: { showTypeLabel?: boolean },
): LessonCatalogItem[] {
  const showTypeLabel = options?.showTypeLabel ?? true
  return lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    initial: resolveInitial(lesson.title),
    searchText: buildSearchText(lesson.title, lesson.summary ?? null),
    durationMinutes: lesson.duration_minutes,
    typeLabel: showTypeLabel ? LESSON_TYPE_LABELS[lesson.lesson_type] ?? null : null,
    trackLabel: getLessonTrackLabel({
      track: lesson.track ?? undefined,
      levelLabel: lesson.level_label ?? undefined,
    }),
    hasModel: Boolean(lesson.has_model),
    isCompleted: lesson.is_completed,
  }))
}

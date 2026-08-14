/**
 * 大课的课时目录：三门大颗粒积木课各 100 节，sort_order 是拼音序而不是教学顺序，
 * 平铺一列没法找。这里把课时按拼音首字母分组，并提供搜索 / 筛选的纯函数，
 * 供服务端预计算后交给客户端组件即时过滤。
 */

/** 小于这个课时数的课程按原顺序展示：Scratch 和五子棋的 sort_order 是真的教学顺序 */
export const LESSON_CATALOG_MIN_SIZE = 24

export const LESSON_CATALOG_OTHER_INITIAL = '#'

export type LessonCatalogFilter = 'all' | 'model' | 'todo' | 'done'

export interface LessonCatalogItem {
  id: number
  title: string
  /** 拼音首字母，A–Z 或 `#` */
  initial: string
  /** 已归一化的搜索文本：标题 + 摘要 + 全拼 + 首字母缩写 */
  searchText: string
  durationMinutes: number | null
  typeLabel: string | null
  trackLabel: string | null
  /** 有 LDraw 模型的课时才有 3D 分步搭建 */
  hasModel: boolean
  isCompleted: boolean
}

export interface LessonCatalogGroup {
  initial: string
  items: LessonCatalogItem[]
}

export function normalizeLessonQuery(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase('zh-CN') ?? ''
}

export function toLessonInitial(pinyinFirstLetter: string | null | undefined): string {
  const initial = pinyinFirstLetter?.trim().charAt(0).toUpperCase() ?? ''
  return /^[A-Z]$/.test(initial) ? initial : LESSON_CATALOG_OTHER_INITIAL
}

/**
 * 按首字母分组。输入必须已经是展示顺序（拼音序），分组只做切段不再排序，
 * 这样课程自己的 sort_order 仍然是唯一的顺序来源。
 */
export function groupLessonCatalog(items: LessonCatalogItem[]): LessonCatalogGroup[] {
  const groups: LessonCatalogGroup[] = []
  const byInitial = new Map<string, LessonCatalogGroup>()

  for (const item of items) {
    let group = byInitial.get(item.initial)
    if (!group) {
      group = { initial: item.initial, items: [] }
      byInitial.set(item.initial, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}

function matchesFilter(item: LessonCatalogItem, filter: LessonCatalogFilter): boolean {
  switch (filter) {
    case 'model':
      return item.hasModel
    case 'todo':
      return !item.isCompleted
    case 'done':
      return item.isCompleted
    default:
      return true
  }
}

export function filterLessonCatalog(
  items: LessonCatalogItem[],
  options: { query?: string; filter?: LessonCatalogFilter },
): LessonCatalogItem[] {
  const query = normalizeLessonQuery(options.query)
  const filter = options.filter ?? 'all'
  if (!query && filter === 'all') return items

  return items.filter((item) => {
    if (!matchesFilter(item, filter)) return false
    return !query || item.searchText.includes(query)
  })
}

/** 索引条要展示全部字母，未命中的置灰而不是消失，避免筛选时索引跳来跳去 */
export function collectLessonInitials(items: LessonCatalogItem[]): string[] {
  const seen = new Set(items.map((item) => item.initial))
  const letters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).filter(
    (letter) => seen.has(letter),
  )
  return seen.has(LESSON_CATALOG_OTHER_INITIAL)
    ? [...letters, LESSON_CATALOG_OTHER_INITIAL]
    : letters
}

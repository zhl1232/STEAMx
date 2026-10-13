export interface KitSelection { setNum: string; copies: number }

/** 页面上让家长填写数量的教育套装（顺序即展示顺序）。 */
export const KIT_CATALOG = [
  { setNum: '9090-2', code: '9090', name: '大颗粒基础套装', image: '/courses/kit-thumbs/9090-2.webp' },
  { setNum: '9076-1', code: '9076', name: '管道实验套装', image: '/courses/kit-thumbs/9076-1.webp' },
  { setNum: '45026-1', code: '45026', name: '管道套装', image: '/courses/kit-thumbs/45026-1.webp' },
  { setNum: '45002-1', code: '45002', name: '科技机械套装', image: '/courses/kit-thumbs/45002-1.webp' },
  { setNum: '9206-1', code: '9206', name: '科技机械套装', image: '/courses/kit-thumbs/9206-1.webp' },
  { setNum: '9656-1', code: '9656', name: '早期简单机械套装', image: '/courses/kit-thumbs/9656-1.webp' },
] as const

export type KitSetNum = (typeof KIT_CATALOG)[number]['setNum']
export type KitCounts = Record<KitSetNum, number>

const DEFAULT_KITS_BY_COURSE: Record<number, Partial<KitCounts>> = {
  5: { '9090-2': 1, '9076-1': 1 },
  6: { '45002-1': 1, '9090-2': 1, '9076-1': 1 },
  7: { '9656-1': 1, '9090-2': 1, '9076-1': 1 },
}

/** 这门课是否提供套装对比（小班/中班/大班积木课）。 */
export function hasKitComparison(courseId: number): boolean {
  return courseId in DEFAULT_KITS_BY_COURSE
}

/** 按课程给出目录中各套装的默认套数（未列出的为 0，45026 与 9206 默认均为 0）。 */
export function getDefaultKitCounts(courseId: number): KitCounts {
  const defaults = DEFAULT_KITS_BY_COURSE[courseId] ?? {}
  return Object.fromEntries(KIT_CATALOG.map(({ setNum }) => [setNum, defaults[setNum] ?? 0])) as KitCounts
}

/** 套数 → 核算用的套装选择；0 套的套装不参与叠加。 */
export function kitCountsToSelections(counts: KitCounts): KitSelection[] {
  return KIT_CATALOG.filter(({ setNum }) => counts[setNum] > 0).map(({ setNum }) => ({
    setNum,
    copies: counts[setNum],
  }))
}

export function getDefaultKitsForCourse(courseId: number): KitSelection[] {
  return kitCountsToSelections(getDefaultKitCounts(courseId))
}

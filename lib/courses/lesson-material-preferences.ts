import {
  KIT_CATALOG,
  getDefaultKitCounts,
  getDefaultKitsForCourse,
  type KitCounts,
  type KitSelection,
} from './course-kit-config'

export interface LessonMaterialPreferences {
  kits: KitSelection[]
  acceptColorSubstitutes: boolean
  includeOptionalBaseplates: boolean
  structuralBaseplates: string[]
}

export const MAX_KIT_COPIES = 20

/** 所有套数必须为非负安全整数，0 表示不使用该套装。 */
export function mergeLessonMaterialPreferences(
  courseId: number,
  overrides: Partial<LessonMaterialPreferences> = {},
): LessonMaterialPreferences {
  const prefs = {
    kits: getDefaultKitsForCourse(courseId),
    acceptColorSubstitutes: true,
    includeOptionalBaseplates: false,
    structuralBaseplates: [],
    ...overrides,
  }
  return {
    ...prefs,
    structuralBaseplates: [...prefs.structuralBaseplates],
    kits: prefs.kits.map((kit) => {
      if (!Number.isSafeInteger(kit.copies) || kit.copies < 0) throw new Error('套数须为非负整数')
      return { ...kit }
    }),
  }
}

/** 把任意输入（localStorage 里可能是旧值或被改坏）收敛成 0–20 的整数套数。 */
export function sanitizeKitCounts(raw: unknown, fallback: KitCounts): KitCounts {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(
    KIT_CATALOG.map(({ setNum }) => {
      const value = source[setNum]
      const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback[setNum]
      return [setNum, Math.min(MAX_KIT_COPIES, Math.max(0, n))]
    }),
  ) as KitCounts
}

/** 每门课单独记，因为各课默认套装不同。 */
export function kitCountsStorageKey(courseId: number): string {
  return `steamx:lesson-kit-counts:v1:course-${courseId}`
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readStoredKitCounts(storage: KeyValueStorage | null | undefined, courseId: number): KitCounts {
  const fallback = getDefaultKitCounts(courseId)
  if (!storage) return fallback
  try {
    const text = storage.getItem(kitCountsStorageKey(courseId))
    return text ? sanitizeKitCounts(JSON.parse(text), fallback) : fallback
  } catch {
    return fallback
  }
}

export function writeStoredKitCounts(
  storage: KeyValueStorage | null | undefined,
  courseId: number,
  counts: KitCounts,
): void {
  try {
    storage?.setItem(kitCountsStorageKey(courseId), JSON.stringify(counts))
  } catch {
    // 隐私模式/配额满：只影响下次打开时的记忆，不影响本次计算。
  }
}

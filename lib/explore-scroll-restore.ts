const STORAGE_KEY = 'explore-scroll-restore-v1'

export type ExploreScrollRestoreState = {
  filtersKey: string
  scrollY: number
  /** 与探索页 `pageRef` 一致：下一页要请求的页码（已加载页数 + 1） */
  nextPage: number
}

const FILTER_PARAM_KEYS = ['q', 'category', 'subCategory', 'difficulty', 'tags', 'sortBy'] as const

export function buildExploreFiltersKey(params: URLSearchParams): string {
  const normalized = new URLSearchParams()
  for (const key of FILTER_PARAM_KEYS) {
    const value = params.get(key)
    if (value) normalized.set(key, value)
  }
  return normalized.toString()
}

export function readExploreScrollRestore(): ExploreScrollRestoreState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as ExploreScrollRestoreState
    if (
      typeof parsed.filtersKey !== 'string'
      || typeof parsed.scrollY !== 'number'
      || !Number.isFinite(parsed.scrollY)
      || typeof parsed.nextPage !== 'number'
      || !Number.isInteger(parsed.nextPage)
      || parsed.nextPage < 1
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveExploreScrollRestore(state: ExploreScrollRestoreState): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage may be unavailable (private mode quota, etc.)
  }
}

export function clearExploreScrollRestore(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

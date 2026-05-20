export type SortBy = 'latest' | 'popular'

/** browse = 兼容旧热门态（无 tab 高亮） */
export type ExplorePresetId = 'browse' | 'beginner-friendly' | 'latest'

export type ExplorePreset = {
    id: Exclude<ExplorePresetId, 'browse'>
    label: string
    sortBy: SortBy
    difficulty: string
}

/** 主列表只保留两个切换入口：默认最新上架，另一个为新手推荐。 */
export const EXPLORE_PRESETS: ExplorePreset[] = [
    { id: 'latest', label: '最新上架', sortBy: 'latest', difficulty: 'all' },
    { id: 'beginner-friendly', label: '新手推荐', sortBy: 'popular', difficulty: '1-2' },
]

export type ExploreFilterState = {
    category: string
    subCategory: string
    difficulty: string
    tags: string[]
    searchQuery: string
    sortBy: SortBy
}

export function parseExploreSortBy(raw: string | null | undefined): SortBy {
    if (raw === 'popular') return 'popular'
    if (raw === 'weekly') return 'popular'
    return 'latest'
}

export const EXPLORE_RESULTS_SORT_OPTIONS = [
    { value: 'popular' as const, label: '推荐' },
    { value: 'latest' as const, label: '最新' },
] as const

/** 用户主动筛选/搜索后进入「结果模式」，与默认「探索逛」分离。 */
export function isExploreResultsMode(state: ExploreFilterState): boolean {
    const activePresetId = detectActivePreset(state)
    const activeListTabId = activePresetId === 'latest' || activePresetId === 'beginner-friendly'
        ? activePresetId
        : null
    const difficultyBelongsToListTab = activeListTabId === 'beginner-friendly'
    const hasActiveAdvancedFilters = !!state.subCategory
        || (!difficultyBelongsToListTab && state.difficulty !== 'all')
        || state.tags.length > 0

    return state.category !== '全部'
        || hasActiveAdvancedFilters
        || !!state.searchQuery.trim()
}

export function detectActivePreset(state: ExploreFilterState): ExplorePresetId | null {
    const {
        difficulty,
        sortBy,
    } = state

    if (sortBy === 'latest' && difficulty === 'all') {
        return 'latest'
    }

    if (difficulty === '1-2' && sortBy === 'popular') {
        return 'beginner-friendly'
    }

    if (difficulty === 'all' && sortBy === 'popular') {
        return 'browse'
    }

    return null
}

/** 默认热门（browse）不高亮任何 chip */
export function resolveHighlightedPresetId(urlPreset: ExplorePresetId | null): ExplorePresetId | null {
    if (urlPreset === null || urlPreset === 'browse') {
        return null
    }
    return urlPreset
}

export function resolveSuggestedPresetId(args: {
    isLoggedIn: boolean
    level: number
    projectsCompleted: number | undefined
}): Exclude<ExplorePresetId, 'browse'> {
    void args
    return 'beginner-friendly'
}

export function getPresetHintLabel(presetId: ExplorePresetId): string {
    const preset = EXPLORE_PRESETS.find((item) => item.id === presetId)
    if (preset) return preset.label
    if (presetId === 'browse') return '热门推荐'
    return '新手推荐'
}

export function buildPresetSearchParams(preset: ExplorePreset): URLSearchParams {
    const params = new URLSearchParams()
    if (preset.difficulty !== 'all') {
        params.set('difficulty', preset.difficulty)
    }
    if (preset.sortBy !== 'latest') {
        params.set('sortBy', preset.sortBy)
    }
    return params
}

export function serializeExploreFilterParams(params: URLSearchParams): string {
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
    return new URLSearchParams(entries).toString()
}

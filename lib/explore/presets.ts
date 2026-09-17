import { normalizeDifficultyParam } from '@/lib/content-classification/validation'

export type SortBy = 'latest' | 'popular'

/** browse = 兼容旧热门态（无 tab 高亮） */
/** beginner-friendly / latest 保留为遗留 id，旧 URL 可解析但不在 UI pills 中展示 */
export type ExplorePresetId = 'browse' | 'beginner-friendly' | 'latest' | 'fun-science'

export type ExplorePreset = {
    id: ExplorePresetId
    label: string
    sortBy: SortBy
    difficulty: string
    /** Optional tag filter applied by the preset (exact set match). */
    tags?: string[]
}

/** 项目内容列表 pills：仅保留热门推荐与趣味科学（启蒙）。 */
export const EXPLORE_PRESETS: ExplorePreset[] = [
    { id: 'browse', label: '热门推荐', sortBy: 'popular', difficulty: 'all' },
    { id: 'fun-science', label: '趣味科学（启蒙）', sortBy: 'popular', difficulty: 'all', tags: ['启蒙版'] },
]

export type ExploreFilterState = {
    category: string
    subCategory: string
    difficulty: string
    age: number | null
    tags: string[]
    searchQuery: string
    sortBy: SortBy
}

export function parseExploreSortBy(raw: string | null | undefined): SortBy {
    if (raw === 'latest') return 'latest'
    return 'popular'
}

export const EXPLORE_RESULTS_SORT_OPTIONS = [
    { value: 'popular' as const, label: '推荐' },
    { value: 'latest' as const, label: '最新' },
] as const

function sameTagSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every((tag) => set.has(tag))
}

function presetTags(preset: ExplorePreset): string[] {
    return preset.tags ?? []
}

/** List-tab presets shown in explore mode (not results mode). */
export function isExploreListTabPreset(id: ExplorePresetId | null): id is ExplorePresetId {
    return id === 'browse' || id === 'fun-science'
}

/** 用户主动筛选/搜索后进入「结果模式」，与默认「探索逛」分离。 */
export function isExploreResultsMode(state: ExploreFilterState): boolean {
    const activePresetId = detectActivePreset(state)
    const activeListTabId = isExploreListTabPreset(activePresetId) ? activePresetId : null
    const activePreset = activeListTabId
        ? EXPLORE_PRESETS.find((item) => item.id === activeListTabId)
        : undefined
    const difficultyBelongsToListTab = false
    const tagsBelongToListTab = !!activePreset
        && presetTags(activePreset).length > 0
        && sameTagSet(state.tags, presetTags(activePreset))
    const hasActiveAdvancedFilters = !!state.subCategory
        || (!difficultyBelongsToListTab && state.difficulty !== 'all')
        || state.age !== null
        || (!tagsBelongToListTab && state.tags.length > 0)

    return state.category !== '全部'
        || hasActiveAdvancedFilters
        || !!state.searchQuery.trim()
}

export function detectActivePreset(state: ExploreFilterState): ExplorePresetId | null {
    const {
        difficulty,
        sortBy,
        tags,
    } = state

    const funScience = EXPLORE_PRESETS.find((item) => item.id === 'fun-science')
    if (
        funScience
        && sameTagSet(tags, presetTags(funScience))
        && difficulty === 'all'
        && sortBy === 'popular'
    ) {
        return 'fun-science'
    }

    if (tags.length > 0) {
        return null
    }

    // 遗留 latest / beginner-friendly：不再高亮 pill，交由 resolveHighlightedPresetId 降级
    if (sortBy === 'latest' && difficulty === 'all') {
        return null
    }

    if (normalizeDifficultyParam(difficulty) === 'beginner' && sortBy === 'popular') {
        return null
    }

    if (difficulty === 'all' && sortBy === 'popular') {
        return 'browse'
    }

    return null
}

/** 旧 URL preset=latest|beginner-friendly 忽略高亮，避免无效 pill / 500。 */
export function resolveHighlightedPresetId(urlPreset: ExplorePresetId | null): ExplorePresetId | null {
    if (urlPreset === 'latest' || urlPreset === 'beginner-friendly') {
        return null
    }
    if (urlPreset && !isExploreListTabPreset(urlPreset)) {
        return null
    }
    return urlPreset
}

export function resolveSuggestedPresetId(args: {
    isLoggedIn: boolean
    level: number
    projectsCompleted: number | undefined
}): Exclude<ExplorePresetId, 'browse' | 'beginner-friendly' | 'latest'> {
    void args
    return 'fun-science'
}

export function getPresetHintLabel(presetId: ExplorePresetId): string {
    const preset = EXPLORE_PRESETS.find((item) => item.id === presetId)
    if (preset) return preset.label
    if (presetId === 'browse') return '热门推荐'
    if (presetId === 'fun-science') return '趣味科学（启蒙）'
    return '趣味科学（启蒙）'
}

export function buildPresetSearchParams(preset: ExplorePreset): URLSearchParams {
    const params = new URLSearchParams()
    if (preset.difficulty !== 'all') {
        params.set('difficulty', preset.difficulty)
    }
    if (preset.sortBy !== 'popular') {
        params.set('sortBy', preset.sortBy)
    }
    const tags = presetTags(preset)
    if (tags.length > 0) {
        params.set('tags', tags.join(','))
    }
    return params
}

export function serializeExploreFilterParams(params: URLSearchParams): string {
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
    return new URLSearchParams(entries).toString()
}

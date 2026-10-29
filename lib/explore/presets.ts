import { normalizeDifficultyParam } from '@/lib/content-classification/validation'

export type SortBy = 'latest' | 'popular'

/** browse = 兼容旧热门态（无 tab 高亮） */
/** beginner-friendly / latest 保留为遗留 id，旧 URL 可解析但不在 UI pills 中展示 */
export type ExplorePresetId = 'browse' | 'beginner-friendly' | 'latest' | 'everyday-materials' | 'fun-science' | 'science-edu'

export const EVERYDAY_MATERIALS_TAG = '日常材料'

export type ExplorePreset = {
    id: ExplorePresetId
    label: string
    sortBy: SortBy
    difficulty: string
    /** Optional tag filter applied by the preset (exact set match). */
    tags?: string[]
}

/** 兼容已有链接的预设；公开主题入口使用 EXPLORE_TOPICS。 */
export const EXPLORE_PRESETS: ExplorePreset[] = [
    { id: 'browse', label: '热门推荐', sortBy: 'popular', difficulty: 'all' },
    { id: 'everyday-materials', label: EVERYDAY_MATERIALS_TAG, sortBy: 'popular', difficulty: 'all', tags: [EVERYDAY_MATERIALS_TAG] },
    { id: 'fun-science', label: '趣味实验', sortBy: 'popular', difficulty: 'all', tags: ['趣味实验'] },
    { id: 'science-edu', label: '科教版', sortBy: 'popular', difficulty: 'all', tags: ['科教版'] },
]

/** 快捷主题与同名标签共用筛选状态，不包含排序入口。 */
export const EXPLORE_TOPICS = EXPLORE_PRESETS.filter(
    (preset): preset is ExplorePreset & { tags: string[] } => !!preset.tags?.length,
)
export const EXPLORE_TOPIC_TAGS: readonly string[] = EXPLORE_TOPICS.flatMap((preset) => preset.tags)
const topicTagSet = new Set(EXPLORE_TOPIC_TAGS)

export function isExploreTopicTag(tag: string): boolean {
    return topicTagSet.has(tag)
}

/** 探索页 URL 只接受三个快捷主题，不再支持任意标签筛选。 */
export function normalizeExploreThemeTags(raw: string | null | undefined): string[] {
    const tags = raw?.split(',').map(tag => tag.trim()) ?? []
    return [...new Set(tags.filter(isExploreTopicTag))]
}

/** 只切换指定主题标签，保留其他筛选标签及其顺序。 */
export function toggleExploreTopicTag(tags: string[], tag: string): string[] {
    return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]
}

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
    { value: 'popular' as const, label: '热门推荐' },
    { value: 'latest' as const, label: '最新发布' },
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
    return id === 'browse' || id === 'everyday-materials' || id === 'fun-science' || id === 'science-edu'
}

/** 用户主动筛选/搜索后进入「结果模式」，与默认「探索逛」分离。 */
export function isExploreResultsMode(state: ExploreFilterState): boolean {
    return state.category !== '全部'
        || !!state.subCategory
        || state.difficulty !== 'all'
        || state.age !== null
        || !!state.searchQuery.trim()
}

export function detectActivePreset(state: ExploreFilterState): ExplorePresetId | null {
    const {
        difficulty,
        sortBy,
        tags,
    } = state

    const taggedListTabs = EXPLORE_PRESETS.filter((item) => presetTags(item).length > 0)
    for (const preset of taggedListTabs) {
        if (
            sameTagSet(tags, presetTags(preset))
            && difficulty === preset.difficulty
            && sortBy === preset.sortBy
        ) {
            return preset.id
        }
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
    if (presetId === 'fun-science') return '趣味实验'
    if (presetId === 'science-edu') return '科教版'
    return '趣味实验'
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
    const normalized = new URLSearchParams(params)
    const tags = normalizeExploreThemeTags(normalized.get('tags'))
    if (tags.length) normalized.set('tags', tags.join(','))
    else normalized.delete('tags')
    const entries = Array.from(normalized.entries()).sort(([a], [b]) => a.localeCompare(b))
    return new URLSearchParams(entries).toString()
}

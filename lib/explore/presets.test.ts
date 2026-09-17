import { describe, expect, it } from 'vitest'

import {
    EXPLORE_PRESETS,
    buildPresetSearchParams,
    detectActivePreset,
    isExploreResultsMode,
    parseExploreSortBy,
    resolveHighlightedPresetId,
    resolveSuggestedPresetId,
    serializeExploreFilterParams,
} from '@/lib/explore/presets'

describe('explore presets', () => {
    it('exposes popular, latest, beginner, and fun-science project tabs', () => {
        expect(EXPLORE_PRESETS.map((preset) => preset.id)).toEqual([
            'browse',
            'latest',
            'beginner-friendly',
            'fun-science',
        ])
        expect(EXPLORE_PRESETS.find((preset) => preset.id === 'fun-science')).toMatchObject({
            label: '趣味科学（启蒙）',
            tags: ['启蒙版'],
            sortBy: 'popular',
            difficulty: 'all',
        })
    })

    it('detects latest, beginner-friendly, fun-science, and legacy browse states', () => {
        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'latest',
        })).toBe('latest')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'beginner',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('beginner-friendly')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: ['启蒙版'],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('fun-science')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('browse')
    })

    it('builds distinct preset search params', () => {
        const popular = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'browse')!)
        const latest = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'latest')!)
        const beginner = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'beginner-friendly')!)
        const funScience = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'fun-science')!)

        expect(popular.toString()).toBe('')
        expect(latest.get('sortBy')).toBe('latest')
        expect(beginner.get('difficulty')).toBe('beginner')
        expect(beginner.get('sortBy')).toBeNull()
        expect(funScience.get('tags')).toBe('启蒙版')
        expect(funScience.get('sortBy')).toBeNull()
        expect(funScience.get('difficulty')).toBeNull()
        expect(new Set([
            serializeExploreFilterParams(popular),
            serializeExploreFilterParams(latest),
            serializeExploreFilterParams(beginner),
            serializeExploreFilterParams(funScience),
        ]).size).toBe(4)
    })

    it('highlights the default popular project tab', () => {
        expect(resolveHighlightedPresetId('browse')).toBe('browse')
        expect(resolveHighlightedPresetId('latest')).toBe('latest')
        expect(resolveHighlightedPresetId('fun-science')).toBe('fun-science')
    })

    it('always suggests beginner-friendly as the fallback helper', () => {
        expect(resolveSuggestedPresetId({
            isLoggedIn: true,
            level: 5,
            projectsCompleted: 8,
        })).toBe('beginner-friendly')
    })

    it('defaults to popular and keeps explicit latest URLs', () => {
        expect(parseExploreSortBy(null)).toBe('popular')
        expect(parseExploreSortBy('weekly')).toBe('popular')
        expect(parseExploreSortBy('latest')).toBe('latest')
    })

    it('enters results mode for explicit filters but keeps preset tabs in explore mode', () => {
        const exploreState = {
            category: '全部',
            subCategory: '',
            difficulty: 'beginner',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'popular' as const,
        }

        expect(isExploreResultsMode(exploreState)).toBe(false)

        expect(isExploreResultsMode({
            ...exploreState,
            difficulty: 'all',
            tags: ['启蒙版'],
        })).toBe(false)

        expect(isExploreResultsMode({
            ...exploreState,
            category: '技术',
        })).toBe(true)

        expect(isExploreResultsMode({
            ...exploreState,
            searchQuery: '化学',
        })).toBe(true)

        expect(isExploreResultsMode({
            ...exploreState,
            tags: ['磁力'],
        })).toBe(true)
    })
})

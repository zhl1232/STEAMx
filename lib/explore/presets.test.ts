import { describe, expect, it } from 'vitest'

import {
    EXPLORE_PRESETS,
    buildPresetSearchParams,
    detectActivePreset,
    getPresetHintLabel,
    isExploreListTabPreset,
    isExploreResultsMode,
    parseExploreSortBy,
    resolveHighlightedPresetId,
    resolveSuggestedPresetId,
    serializeExploreFilterParams,
} from '@/lib/explore/presets'

describe('explore presets', () => {
    it('exposes popular, fun-science, and science-edu project tabs', () => {
        expect(EXPLORE_PRESETS.map((preset) => preset.id)).toEqual([
            'browse',
            'fun-science',
            'science-edu',
        ])
        expect(EXPLORE_PRESETS.find((preset) => preset.id === 'fun-science')).toMatchObject({
            label: '趣味实验',
            tags: ['趣味实验'],
            sortBy: 'popular',
            difficulty: 'all',
        })
        expect(EXPLORE_PRESETS.find((preset) => preset.id === 'science-edu')).toMatchObject({
            label: '科教版',
            tags: ['科教版'],
            sortBy: 'popular',
            difficulty: 'all',
        })
        expect(getPresetHintLabel('fun-science')).toBe('趣味实验')
        expect(getPresetHintLabel('science-edu')).toBe('科教版')
        expect(EXPLORE_PRESETS.find((preset) => preset.id === 'browse')).toMatchObject({
            label: '热门推荐',
            sortBy: 'popular',
            difficulty: 'all',
        })
        expect(isExploreListTabPreset('browse')).toBe(true)
        expect(isExploreListTabPreset('fun-science')).toBe(true)
        expect(isExploreListTabPreset('science-edu')).toBe(true)
        expect(isExploreListTabPreset('latest')).toBe(false)
        expect(isExploreListTabPreset('beginner-friendly')).toBe(false)
    })

    it('detects fun-science, science-edu, and browse; ignores legacy latest/beginner highlight', () => {
        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'latest',
        })).toBeNull()

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'beginner',
            age: null,
            tags: [],
            searchQuery: '',
            sortBy: 'popular',
        })).toBeNull()

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: ['趣味实验'],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('fun-science')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: ['科教版'],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('science-edu')

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

    it('builds distinct preset search params for remaining pills', () => {
        const popular = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'browse')!)
        const funScience = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'fun-science')!)
        const scienceEdu = buildPresetSearchParams(EXPLORE_PRESETS.find((preset) => preset.id === 'science-edu')!)

        expect(popular.toString()).toBe('')
        expect(funScience.get('tags')).toBe('趣味实验')
        expect(funScience.get('sortBy')).toBeNull()
        expect(funScience.get('difficulty')).toBeNull()
        expect(scienceEdu.get('tags')).toBe('科教版')
        expect(scienceEdu.get('sortBy')).toBeNull()
        expect(scienceEdu.get('difficulty')).toBeNull()
        expect(new Set([
            serializeExploreFilterParams(popular),
            serializeExploreFilterParams(funScience),
            serializeExploreFilterParams(scienceEdu),
        ]).size).toBe(3)
    })

    it('highlights remaining pills and degrades legacy latest/beginner', () => {
        expect(resolveHighlightedPresetId('browse')).toBe('browse')
        expect(resolveHighlightedPresetId('fun-science')).toBe('fun-science')
        expect(resolveHighlightedPresetId('science-edu')).toBe('science-edu')
        expect(resolveHighlightedPresetId('latest')).toBeNull()
        expect(resolveHighlightedPresetId('beginner-friendly')).toBeNull()
        expect(resolveHighlightedPresetId(null)).toBeNull()
    })

    it('suggests fun-science as the fallback helper', () => {
        expect(resolveSuggestedPresetId({
            isLoggedIn: true,
            level: 5,
            projectsCompleted: 8,
        })).toBe('fun-science')
    })

    it('defaults to popular and keeps explicit latest URLs', () => {
        expect(parseExploreSortBy(null)).toBe('popular')
        expect(parseExploreSortBy('weekly')).toBe('popular')
        expect(parseExploreSortBy('latest')).toBe('latest')
    })

    it('enters results mode for explicit filters but keeps fun-science and science-edu in explore mode', () => {
        const exploreState = {
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            age: null,
            tags: [] as string[],
            searchQuery: '',
            sortBy: 'popular' as const,
        }

        expect(isExploreResultsMode(exploreState)).toBe(false)

        expect(isExploreResultsMode({
            ...exploreState,
            tags: ['趣味实验'],
        })).toBe(false)

        expect(isExploreResultsMode({
            ...exploreState,
            tags: ['科教版'],
        })).toBe(false)

        // Legacy beginner filter: no pill, but results mode via difficulty
        expect(isExploreResultsMode({
            ...exploreState,
            difficulty: 'beginner',
        })).toBe(true)

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

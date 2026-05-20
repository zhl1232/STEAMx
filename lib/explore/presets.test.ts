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
    it('exposes two list tabs without browse chip', () => {
        expect(EXPLORE_PRESETS.map((preset) => preset.id)).toEqual([
            'latest',
            'beginner-friendly',
        ])
    })

    it('detects latest, beginner-friendly, and legacy browse states', () => {
        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            tags: [],
            searchQuery: '',
            sortBy: 'latest',
        })).toBe('latest')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: '1-2',
            tags: [],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('beginner-friendly')

        expect(detectActivePreset({
            category: '全部',
            subCategory: '',
            difficulty: 'all',
            tags: [],
            searchQuery: '',
            sortBy: 'popular',
        })).toBe('browse')
    })

    it('builds distinct preset search params', () => {
        const latest = buildPresetSearchParams(EXPLORE_PRESETS[0])
        const beginner = buildPresetSearchParams(EXPLORE_PRESETS[1])

        expect(latest.toString()).toBe('')
        expect(beginner.get('difficulty')).toBe('1-2')
        expect(beginner.get('sortBy')).toBe('popular')
        expect(new Set([
            serializeExploreFilterParams(latest),
            serializeExploreFilterParams(beginner),
        ]).size).toBe(2)
    })

    it('does not highlight default browse state', () => {
        expect(resolveHighlightedPresetId('browse')).toBeNull()
        expect(resolveHighlightedPresetId('latest')).toBe('latest')
    })

    it('always suggests beginner-friendly as the fallback helper', () => {
        expect(resolveSuggestedPresetId({
            isLoggedIn: true,
            level: 5,
            projectsCompleted: 8,
        })).toBe('beginner-friendly')
    })

    it('defaults to latest and downgrades old weekly URLs to popular', () => {
        expect(parseExploreSortBy(null)).toBe('latest')
        expect(parseExploreSortBy('weekly')).toBe('popular')
    })

    it('enters results mode for explicit filters but keeps preset tabs in explore mode', () => {
        const exploreState = {
            category: '全部',
            subCategory: '',
            difficulty: '1-2',
            tags: [],
            searchQuery: '',
            sortBy: 'popular' as const,
        }

        expect(isExploreResultsMode(exploreState)).toBe(false)

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

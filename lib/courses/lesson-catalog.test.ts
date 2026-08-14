import { describe, expect, it } from 'vitest'

import {
  collectLessonInitials,
  filterLessonCatalog,
  groupLessonCatalog,
  toLessonInitial,
  type LessonCatalogItem,
} from './lesson-catalog'
import { buildLessonCatalogItems } from './lesson-catalog-builder'
import type { CourseLessonSummary } from './types'

function lesson(overrides: Partial<CourseLessonSummary> & { id: number; title: string }): CourseLessonSummary {
  return {
    course_id: 5,
    lesson_type: 'building_3d',
    sort_order: overrides.id,
    duration_minutes: 40,
    track: null,
    level_label: null,
    summary: null,
    has_model: false,
    is_completed: false,
    ...overrides,
  }
}

describe('toLessonInitial', () => {
  it('keeps A-Z and buckets everything else under #', () => {
    expect(toLessonInitial('cheng bao')).toBe('C')
    expect(toLessonInitial('')).toBe('#')
    expect(toLessonInitial('3d')).toBe('#')
  })
})

describe('buildLessonCatalogItems', () => {
  it('derives the pinyin initial from a Chinese title', () => {
    const [item] = buildLessonCatalogItems([lesson({ id: 1, title: '埃菲尔铁塔' })])
    expect(item.initial).toBe('A')
  })

  it('makes a lesson findable by Chinese, full pinyin and pinyin initials', () => {
    const items = buildLessonCatalogItems([lesson({ id: 1, title: '长颈龙', summary: '恐龙滑梯游乐场' })])

    for (const query of ['长颈龙', 'changjinglong', 'cjl', '恐龙']) {
      expect(filterLessonCatalog(items, { query }), query).toHaveLength(1)
    }
    expect(filterLessonCatalog(items, { query: '城堡' })).toHaveLength(0)
  })

  it('flags lessons that ship an LDraw model', () => {
    const items = buildLessonCatalogItems([
      lesson({ id: 1, title: '宝剑', has_model: true }),
      lesson({ id: 2, title: '城堡' }),
    ])
    expect(items.map((item) => item.hasModel)).toEqual([true, false])
  })

  it('hides the lesson type badge when every lesson is the same type', () => {
    const [withLabel] = buildLessonCatalogItems([lesson({ id: 1, title: '宝剑' })])
    const [withoutLabel] = buildLessonCatalogItems([lesson({ id: 1, title: '宝剑' })], {
      showTypeLabel: false,
    })
    expect(withLabel.typeLabel).toBe('搭建')
    expect(withoutLabel.typeLabel).toBeNull()
  })
})

describe('filterLessonCatalog', () => {
  const items = buildLessonCatalogItems([
    lesson({ id: 1, title: '宝剑', has_model: true, is_completed: true }),
    lesson({ id: 2, title: '城堡' }),
    lesson({ id: 3, title: '大象', has_model: true }),
  ])

  it('returns the original array when nothing is filtered', () => {
    expect(filterLessonCatalog(items, {})).toBe(items)
  })

  it('filters by model, done and todo', () => {
    expect(filterLessonCatalog(items, { filter: 'model' }).map((i) => i.id)).toEqual([1, 3])
    expect(filterLessonCatalog(items, { filter: 'done' }).map((i) => i.id)).toEqual([1])
    expect(filterLessonCatalog(items, { filter: 'todo' }).map((i) => i.id)).toEqual([2, 3])
  })

  it('combines query and filter', () => {
    expect(filterLessonCatalog(items, { query: '大象', filter: 'model' }).map((i) => i.id)).toEqual([3])
    expect(filterLessonCatalog(items, { query: '大象', filter: 'done' })).toHaveLength(0)
  })
})

describe('groupLessonCatalog', () => {
  const items: LessonCatalogItem[] = buildLessonCatalogItems([
    lesson({ id: 1, title: '宝剑' }),
    lesson({ id: 2, title: '冰球运动员' }),
    lesson({ id: 3, title: '城堡' }),
  ])

  it('slices the incoming order into initial groups without resorting', () => {
    expect(groupLessonCatalog(items)).toEqual([
      { initial: 'B', items: [items[0], items[1]] },
      { initial: 'C', items: [items[2]] },
    ])
  })

  it('lists only the initials present, alphabetically, with # last', () => {
    const withOther = [...items, ...buildLessonCatalogItems([lesson({ id: 4, title: '3D 打印笔' })])]
    expect(collectLessonInitials(withOther)).toEqual(['B', 'C', '#'])
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import {
  EXPLORE_CONTEXT_QUEUE_LIMIT,
  EXPLORE_PROJECT_CONTEXT_STORAGE_KEY,
  advanceExploreProjectContext,
  buildExploreProjectContext,
  readExploreProjectContext,
  saveExploreProjectContext,
} from './project-navigation-context'
import type { Project } from '@/lib/mappers/types'

const project = (id: number): Project => ({
  id,
  title: `项目${id}`,
  author: '作者',
  author_id: 'a',
  image: `/img/${id}.webp`,
  category: '科学',
  likes: 0,
  description: `描述${id}`,
})

describe('explore project navigation context', () => {
  beforeEach(() => sessionStorage.clear())

  it('captures the filtered explore URL and the following cards', () => {
    const projects = [1, 2, 3, 4].map(project)
    const context = buildExploreProjectContext(projects, 1, '/explore?tags=%E7%A3%81%E5%8A%9B')
    expect(context).toMatchObject({ projectId: '2', exploreHref: '/explore?tags=%E7%A3%81%E5%8A%9B' })
    expect(context?.queue.map((item) => item.id)).toEqual([3, 4])
  })

  it('caps the queue size', () => {
    const projects = Array.from({ length: 60 }, (_, index) => project(index + 1))
    expect(buildExploreProjectContext(projects, 0, '/explore')?.queue).toHaveLength(EXPLORE_CONTEXT_QUEUE_LIMIT)
  })

  it('rejects non-explore return targets', () => {
    expect(buildExploreProjectContext([project(1)], 0, 'https://evil.example/explore')).toBeNull()
    expect(buildExploreProjectContext([project(1)], 0, '//evil.example/explore')).toBeNull()
    expect(buildExploreProjectContext([project(1)], 0, '/login')).toBeNull()
  })

  it('round-trips through sessionStorage only for the matching project', () => {
    saveExploreProjectContext(buildExploreProjectContext([1, 2, 3].map(project), 0, '/explore?sortBy=latest'))
    expect(readExploreProjectContext(1)?.exploreHref).toBe('/explore?sortBy=latest')
    expect(readExploreProjectContext('1')?.queue.map((item) => item.id)).toEqual([2, 3])
    expect(readExploreProjectContext(2)).toBeNull()
  })

  it('advances to the next project so "继续看下一个项目" can chain', () => {
    const context = buildExploreProjectContext([1, 2, 3].map(project), 0, '/explore')!
    const next = advanceExploreProjectContext(context)
    expect(next).toMatchObject({ projectId: '2', exploreHref: '/explore' })
    expect(next?.queue.map((item) => item.id)).toEqual([3])
    expect(advanceExploreProjectContext(advanceExploreProjectContext(next!)!)).toBeNull()
  })

  it('ignores malformed storage', () => {
    sessionStorage.setItem(EXPLORE_PROJECT_CONTEXT_STORAGE_KEY, '{not json')
    expect(readExploreProjectContext(1)).toBeNull()
    sessionStorage.setItem(EXPLORE_PROJECT_CONTEXT_STORAGE_KEY, JSON.stringify({ projectId: '1', exploreHref: 'javascript:alert(1)', queue: [] }))
    expect(readExploreProjectContext(1)).toBeNull()
  })
})

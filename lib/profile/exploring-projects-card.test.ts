import { describe, expect, it } from 'vitest'

import type { Project } from '@/lib/mappers/types'
import { buildExploringActivityMap, getExploringCardSubtitle } from './exploring-projects-card'

function makeProject(id: number, title: string, description = ''): Project {
  return {
    id,
    title,
    description,
    image: '',
    author: 'test',
    author_id: 'user-1',
    category: 'science',
    likes: 0,
    views_count: 0,
  } as Project
}

describe('buildExploringActivityMap', () => {
  it('maps project ids to last activity timestamps', () => {
    expect(
      buildExploringActivityMap([
        { projectId: 1, lastActivityAt: '2026-05-01T00:00:00.000Z' },
        { projectId: 2, lastActivityAt: '2026-05-02T00:00:00.000Z' },
      ]),
    ).toEqual({
      1: '2026-05-01T00:00:00.000Z',
      2: '2026-05-02T00:00:00.000Z',
    })
  })
})

describe('getExploringCardSubtitle', () => {
  it('shows relative last activity when available', () => {
    const subtitle = getExploringCardSubtitle(
      makeProject(1, '太阳能小车'),
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    )
    expect(subtitle.length).toBeGreaterThan(0)
    expect(subtitle).not.toBe('继续探索')
  })

  it('falls back to description without activity', () => {
    expect(
      getExploringCardSubtitle(makeProject(1, '太阳能小车', '记录风铃实验'), null),
    ).toBe('记录风铃实验')
  })

  it('falls back to default copy', () => {
    expect(getExploringCardSubtitle(makeProject(1, '太阳能小车'))).toBe('继续探索')
  })
})

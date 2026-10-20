import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/explore-data', () => ({
  getProjectById: vi.fn(),
  getProjectCompletions: vi.fn().mockResolvedValue([]),
  getProjectCompletionsCount: vi.fn().mockResolvedValue(0),
  getProjectCollectionsCount: vi.fn().mockResolvedValue(0),
  getProjectTotalCoinsReceived: vi.fn().mockResolvedValue(0),
  getRelatedProjects: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  createPublicClient: vi.fn(),
}))
vi.mock('@/lib/store/service', () => ({ listStoreProductsForContext: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/api/courses', () => ({ getCourseLessonByWorksProjectId: vi.fn().mockResolvedValue(null) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import ProjectDetailPage from './page'
import { buildSitemapEntries } from '@/app/sitemap'
import { getProjectById } from '@/lib/api/explore-data'
import { JsonLd } from '@/components/seo/json-ld'
import type { Project } from '@/lib/mappers/types'
import { applyLedCardContent } from '@/lib/project/led-card'
import { applyScienceSample } from '@/lib/project/science-samples'
import reviewed from '@/lib/project/science-reviewed.data.json'

// Inspect the server page output without mounting unrelated interactive children.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

describe('project detail dates and sitemap', () => {
  it.each([
    [149, '2026-03-24T00:00:00Z', '2026-10-09T10:01:35.000Z'],
    [478, '2026-03-24T00:00:00Z', '2026-10-11T10:25:44.000Z'],
    [738, '2026-03-24T00:00:00Z', '2026-10-12T02:50:18.000Z'],
    [1176, '2026-03-24T00:00:00Z', '2026-10-12T08:39:06.000Z'],
    [1323, '2026-10-15T00:00:00Z', '2026-10-15T00:00:00.000Z'],
    [42, '2026-03-24T00:00:00Z', '2026-03-24T00:00:00.000Z'],
    [42, 'invalid', undefined],
  ])('project %i uses the same date for visible time, Article and sitemap (%s)', async (id, databaseDate, expected) => {
    const project: Project = {
      id, title: reviewed.find(row => row.id === id)?.title ?? '测试项目', category: '科学',
      author: '', author_id: '', image: '', likes: 0, status: 'approved', moderation_state: 'approved',
      createdAt: '2026-03-01T00:00:00Z', updatedAt: databaseDate,
    }
    vi.mocked(getProjectById).mockResolvedValue(applyScienceSample(applyLedCardContent(project)))
    const output = elements(await ProjectDetailPage({ params: Promise.resolve({ id: String(id) }) }))
    const times = output.filter(element => element.type === 'time')
    expect(times.map(time => time.props.dateTime)).toEqual([
      '2026-03-01T00:00:00.000Z', ...(expected ? [expected] : []),
    ])
    if (expected) {
      expect(times[1].props.children).toBe(new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date(expected)))
    }
    const jsonLd = output.find(element => element.type === JsonLd)!.props.data as Record<string, unknown> & { '@graph'?: Record<string, unknown>[] }
    const article = jsonLd['@graph']?.find(item => item['@type'] === 'Article') ?? jsonLd
    expect(article.dateModified).toBe(expected)
    expect(article.dateCreated).toBe('2026-03-01T00:00:00.000Z')
    expect(article).not.toHaveProperty('datePublished')
    const entries = buildSitemapEntries({
      projects: [{ id, title: project.title, category: project.category, updated_at: databaseDate }],
      species: [], observations: [], courses: [], lessons: [], works: [], resources: [], challenges: [],
    })
    const sitemapDate = entries.find(entry => new URL(entry.url).pathname === `/project/${id}`)!.lastModified
    expect(sitemapDate instanceof Date ? sitemapDate.toISOString() : sitemapDate).toBe(expected)
  })
})

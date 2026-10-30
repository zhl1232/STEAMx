import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicUserProfile } from '@/lib/api/public-user-profile'
import { getWeeklyPlanData } from '@/lib/api/weekly-plan-data'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyPlan } from '@/lib/profile/weekly-plan'
import demonstrations from '@/lib/project/demonstration-images.data.json'
// Keep this suite focused on generated-art fallback when no source tutorial supersedes it.
vi.mock('@/lib/project/source-tutorials.data.json', () => ({ default: [] }))

vi.mock('@/lib/project/demonstration-images.data.json', async importOriginal => {
  const original = await importOriginal<{ default: unknown[] }>()
  const { applyLedCardContent } = await import('@/lib/project/led-card')
  const corrected = applyLedCardContent({ id: 149, title: 'LED 发光贺卡', category: '技术', image: '', author: '', author_id: '', likes: 0 })
  return { default: [...original.default.filter(item => (item as { id: number }).id !== 149), {
    id: 149, title: corrected.title, category: corrected.category,
    sourceImage: corrected.image, image: '/project-guides/demos/project-149-test.webp',
    description: corrected.description, materials: corrected.materials,
    steps: corrected.steps?.map(({ title, description }) => ({ title, description })), kind: 'demonstration',
  }] }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/supabase/rpc', () => ({ callRpc: async () => ({ data: null, error: null }) }))
vi.mock('@/lib/works/data', () => ({ getUserWorks: async () => ({ works: [], total: 0, hasMore: false }) }))
vi.mock('@/lib/api/nature-observation-data', () => ({ loadObservationSpeciesForEvents: async () => new Map() }))
vi.mock('@/lib/api/nature-observation-progress', () => ({ getNaturalObservationProgressSummary: async () => null }))
vi.mock('@/lib/profile/steam-radar', () => ({ getSteamRadarWithGuidanceSafe: async () => null }))
vi.mock('@/lib/profile/weekly-plan', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/profile/weekly-plan')>(),
  buildWeeklyPlan: vi.fn(input => input),
}))
vi.mock('@/lib/content-classification', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/content-classification')>(),
  getContentClassificationSettings: async () => ({ publicV1Enabled: false, enforcementEnabled: false }),
}))

const USER_ID = '11111111-1111-1111-1111-111111111111'
const entries = [307, 149].map(id => demonstrations.find(item => item.id === id)!)

describe('profile demonstration cover hydration', () => {
  let row: Record<string, unknown>
  let queries: string[]
  beforeEach(() => { vi.clearAllMocks(); queries = [] })

  function install(entry: typeof entries[number]) {
    row = {
      id: entry.id, title: entry.title, category: entry.category, image_url: entry.sourceImage,
      description: entry.id === 149 ? '数据库中的旧说明' : entry.description,
      video_url: null, author_id: USER_ID, likes_count: 0, status: 'approved', moderation_state: 'approved',
      image_materials: entry.id === 149 ? [] : entry.materials.map((material, sort_order) => ({ material, sort_order })),
      image_steps: entry.id === 149 ? [] : entry.steps.map((step, sort_order) => ({ ...step, sort_order })),
    }
    row.project_materials = row.image_materials
    row.project_steps = row.image_steps
    const client = { from: (table: string) => {
      let selection = ''
      const result = () => ({ data: table === 'projects' && selection.includes('profiles:author_id') ? [row]
        : table === 'project_explorations' ? [{ project_id: row.id }] : [], error: null, count: table === 'projects' ? 1 : 0 })
      const query: Record<string, unknown> = {
        select: (value: string) => { selection = value; if (table === 'projects') queries.push(value); return query },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
        maybeSingle: async () => ({ data: { id: USER_ID, bio: '' }, error: null }),
      }
      for (const method of ['eq', 'in', 'order', 'range', 'limit', 'gte']) query[method] = () => query
      return query
    } }
    vi.mocked(createClient).mockResolvedValue(client as never)
    return client
  }

  it.each(entries)('hydrates public project covers against effective instructions for $id', async entry => {
    install(entry)
    // The public profile uses image-only aliases, keeping its existing output projection.
    delete row.project_materials
    delete row.project_steps
    const result = await getPublicUserProfile(USER_ID)
    expect(result?.projects[0].image).toBe(entry.image)
    expect(result?.projects[0].description).toBe(row.description)
    expect(result?.projects[0].materials).toEqual([])
    expect(queries[0]).toContain('image_materials:project_materials(material,sort_order)')
    expect(queries[0]).toContain('image_steps:project_steps(title,description,sort_order)')
    expect(queries[0]).toContain('video_url')
  })

  it.each(entries)('hydrates owned and continuing weekly projects against effective instructions for $id', async entry => {
    const client = install(entry)
    await getWeeklyPlanData(client as never, USER_ID)
    const input = vi.mocked(buildWeeklyPlan).mock.calls[0][0]
    for (const project of [input.myProjects[0], input.exploringProjects[0]]) {
      expect(project.image).toBe(entry.image)
      expect(project.description).toBe(row.description)
      expect(project.materials).toBeUndefined()
    }
    const coverQueries = queries.filter(selection => selection.includes('profiles:author_id'))
    expect(coverQueries).toHaveLength(2)
    expect(coverQueries.every(selection => selection.includes('project_materials(material, sort_order)') && selection.includes('project_steps(title, description, sort_order)'))).toBe(true)
  })

  it('preserves new photos and opts out for new videos or missing instruction fields', async () => {
    for (const patch of [{ image_url: '/uploads/new.webp' }, { video_url: 'https://example.com/new.mp4' }, { image_steps: undefined }]) {
      install(entries[0])
      delete row.project_materials
      delete row.project_steps
      Object.assign(row, patch)
      const result = await getPublicUserProfile(USER_ID)
      expect(result?.projects[0].image).toBe(row.image_url)
    }
  })
})

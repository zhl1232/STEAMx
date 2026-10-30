import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjects, getProjectById } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import demonstrations from '@/lib/project/demonstration-images.data.json'
// Generated-art fallback; real source replacements have their own full-copy regression suite.
vi.mock('@/lib/project/source-tutorials.data.json', () => ({ default: [] }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/testing/playwright-smoke', () => ({ isPlaywrightSmoke: () => false }))
vi.mock('@/lib/content-classification', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/content-classification')>(),
  getContentClassificationSettings: async () => ({ publicV1Enabled: false, enforcementEnabled: false }),
}))

describe('demonstration cover read paths', () => {
  const demo = demonstrations.find(item => item.id === 307)!
  let selection = ''
  let row: Record<string, unknown>
  beforeEach(() => {
    row = {
      id: demo.id, title: demo.title, category: demo.category, description: demo.description,
      image_url: demo.sourceImage, video_url: null, likes_count: 0,
      status: 'approved', moderation_state: 'approved',
      image_materials: demo.materials.map((material, sort_order) => ({ material, sort_order })),
      image_steps: demo.steps.map((step, sort_order) => ({ ...step, sort_order })),
      // Simulate the existing filtered association; it must not substitute for the full image projection.
      project_materials: [{ material: demo.materials[0], sort_order: 0 }],
    }
    const query: Record<string, unknown> = {
      select: (value: string) => { selection = value; return query },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], count: 1, error: null }).then(resolve),
      maybeSingle: async () => ({ data: row, error: null }),
    }
    for (const method of ['eq', 'in', 'order', 'range']) query[method] = () => query
    vi.mocked(createClient).mockResolvedValue({ from: () => query, rpc: async () => ({ data: [], error: null }) } as never)
  })

  it('hydrates a list cover from full image-only instructions without expanding its materials', async () => {
    const { projects } = await getProjects({}, { sortBy: 'latest' })
    expect(projects[0].image).toBe(demo.image)
    expect(projects[0].materials).toEqual([demo.materials[0]])
    expect(projects[0].steps).toEqual([])
    expect(selection).toContain('image_materials:project_materials(material,sort_order)')
    expect(selection).toContain('image_steps:project_steps(title,description,sort_order)')
    expect(selection).toContain('video_url')
  })

  it.each([{ description: '新正文' }, { video_url: 'https://example.com/new.mp4' }, { image_url: '/uploads/new.png' }])(
    'retains a safe source cover after source edits: %j', async patch => {
      Object.assign(row, patch)
      const { projects } = await getProjects({}, { sortBy: 'latest' })
      expect(projects[0].image).toBe(row.image_url)
    },
  )

  it('uses the same generated cover on full detail without assigning it to individual steps', async () => {
    row.project_materials = row.image_materials
    row.project_steps = row.image_steps
    const project = await getProjectById(demo.id)
    expect(project?.image).toBe(demo.image)
    expect(project?.steps?.map(step => [step.title, step.description])).toEqual(demo.steps.map(step => [step.title, step.description]))
    expect(project?.steps?.every(step => !step.image_url)).toBe(true)
  })

  it('does not display the storyboard when a video is added to the full detail', async () => {
    row.project_materials = row.image_materials
    row.project_steps = row.image_steps
    row.video_url = 'https://example.com/new.mp4'
    const project = await getProjectById(demo.id)
    expect(project?.image).toBe(demo.sourceImage)
    expect(project?.videoUrl).toBe(row.video_url)
  })

  it('preserves a new manual cover through the LED content override on detail', async () => {
    Object.assign(row, { id: 149, title: 'LED 发光贺卡', category: '技术', description: '旧说明',
      image_url: '/uploads/new-led-photo.webp', project_materials: [], project_steps: [] })
    const project = await getProjectById(149)
    expect(project?.description).toContain('打开会亮、合上会灭')
    expect(project?.image).toBe('/uploads/new-led-photo.webp')
  })
})

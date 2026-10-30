import { describe, expect, it, vi } from 'vitest'
// Exercise the generated-art fallback independently of source tutorials that supersede it.
vi.mock('./source-tutorials.data.json', () => ({ default: [] }))
import type { Project } from '@/lib/mappers/types'
import { mapDbProject } from '@/lib/mappers/types'
import { mapProjectWithDetails, type DbProject } from '@/lib/mappers/project'
import demonstrations from './demonstration-images.data.json'
import { applyProjectDemonstration, applyProjectImageReview, getProjectCoverPresentation, getProjectDemonstration } from './image-presentation'
import { applyEffectiveProjectDemonstration } from './demonstration-content.server'

const entry = demonstrations.find(item => item.id === 307)!
const source: Project = { ...entry, image: entry.sourceImage, videoUrl: null, author: '', author_id: '', likes: 0 }

describe('content-bound generated demonstrations', () => {
  it.each(demonstrations)('uses only the exact effective instructions for $id', item => {
    const project: Project = { ...item, image: item.sourceImage, videoUrl: null, author: '', author_id: '', likes: 0 }
    const before = structuredClone(project)
    const illustrated = applyProjectDemonstration(project)
    expect(illustrated.image).toBe(item.image)
    expect(project).toEqual(before)
    expect(illustrated.steps).toBe(project.steps)
    expect(applyProjectDemonstration(illustrated)).toBe(illustrated)
    expect(getProjectDemonstration(illustrated)?.image).toBe(item.image)
    expect(getProjectCoverPresentation(item.image).fit).toBe('contain')
    expect(getProjectCoverPresentation(item.image).notice).toBe(item.kind === 'principle'
      ? '原理与结构示意，操作细节以正文为准。' : '生成演示图，具体操作见步骤说明。')
  })

  it.each([
    { id: -1 }, { title: '改名' }, { category: '工程' },
    { description: '新正文' }, { materials: ['新材料'] },
    { steps: [{ title: '新动作', description: '新正文' }] },
    { materials: undefined }, { steps: undefined },
    { videoUrl: 'https://example.com/new.mp4' },
    { image: '/uploads/new-photo.png' },
  ])('opts out when identity, source image or instructions change: %j', patch => {
    const changed = { ...source, ...patch }
    expect(applyProjectDemonstration(changed)).toBe(changed)
    expect(getProjectDemonstration(changed)).toBeNull()
  })

  it('runs the effective revision chain for cover matching without changing public list fields', () => {
    const raw = { ...source }
    const illustrated = applyEffectiveProjectDemonstration(raw)
    expect(illustrated.image).toBe(entry.image)
    expect(illustrated.materials).toBe(raw.materials)
    expect(illustrated.steps).toBe(raw.steps)
    expect(applyEffectiveProjectDemonstration({ ...raw, description: '后来改写' }).image).toBe(raw.image)
    expect(applyEffectiveProjectDemonstration({ ...raw, image: '/uploads/new.png' }).image).toBe('/uploads/new.png')
    expect(applyEffectiveProjectDemonstration({ ...raw, videoUrl: 'https://example.com/new.mp4' }).image).toBe(raw.image)
  })

  it('supports complete mapper inputs and retains missing-field fallbacks', () => {
    const row = { id: entry.id, title: entry.title, category: entry.category, description: entry.description,
      image_url: entry.sourceImage, video_url: null,
      project_materials: entry.materials.map((material, sort_order) => ({ material, sort_order })),
      project_steps: entry.steps.map((step, sort_order) => ({ ...step, sort_order })),
    }
    expect(mapDbProject(row as Parameters<typeof mapDbProject>[0]).image).toBe(entry.image)
    expect(mapProjectWithDetails(row as DbProject).image).toBe(entry.image)
    expect(mapDbProject({ ...row, project_steps: undefined } as Parameters<typeof mapDbProject>[0]).image).toBe(entry.sourceImage)
    expect(applyProjectImageReview({ ...source, image: '/uploads/new.png' }).image).toBe('/uploads/new.png')
  })
})

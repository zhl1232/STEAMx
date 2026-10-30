import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import { mapDbProject } from '@/lib/mappers/types'
import { mapProjectWithDetails, type DbProject } from '@/lib/mappers/project'
import data from './source-tutorials.data.json'
import { applyProjectSourceTutorial, getProjectSourceTutorial, isValidSourceTutorial, type ProjectSourceTutorial } from './source-tutorials'
import { applyEffectiveProjectDemonstration } from './demonstration-content.server'
import { applyScienceSample, getScienceSampleForProject } from './science-samples'
import { applyLedCardContent } from './led-card'
import { getProjectRevisionPresentation } from './content-revisions'
import { getHouseholdProfile } from './household-profile'
import { getProjectCoverPresentation, getProjectDemonstration } from './image-presentation'

const entries = data as ProjectSourceTutorial[]
const baseline = (entry: ProjectSourceTutorial): Project => ({
  id: entry.id, title: entry.title, category: entry.category,
  description: entry.baseline.description, materials: [...entry.baseline.materials],
  steps: entry.baseline.steps.map(step => ({ ...step })), image: entry.baseline.covers[0],
  videoUrl: null, author: '原作者', author_id: 'author', likes: 0,
  faq: [{ question: '旧内容', answer: '旧回答' }], householdRequirements: [['old']],
})

describe('complete source tutorials', () => {
  it.each(entries)('binds reviewed copy and crop evidence for $id', entry => {
    expect(isValidSourceTutorial(entry)).toBe(true)
    const original = baseline(entry)
    const before = structuredClone(original)
    const effective = applyEffectiveProjectDemonstration(original)
    expect(effective).toMatchObject(entry.replacement)
    expect(original).toEqual(before)
    expect(effective.faq).toBeUndefined()
    expect(effective.householdRequirements).toBeUndefined()
    expect(effective.classification).toBeNull()
    expect(getProjectSourceTutorial(effective)?.id).toBe(entry.id)
    expect(getScienceSampleForProject(effective)).toBeNull()
    expect(getProjectRevisionPresentation(effective)).toBeNull()
    expect(getHouseholdProfile(effective)).toBeNull()
    expect(getProjectDemonstration(effective)).toBeNull()
    expect(applyScienceSample(effective)).toBe(effective)
    expect(applyLedCardContent(effective)).toBe(effective)
    expect(getProjectCoverPresentation(effective.image)).toEqual({ fit: 'contain' })
  })

  it.each(entries)('uses the same complete replacement in both full mappers for $id', entry => {
    const source = baseline(entry)
    const row = {
      id: entry.id, title: entry.title, category: entry.category, description: source.description,
      image_url: source.image, video_url: null, author_id: 'author', likes_count: 0,
      project_materials: entry.baseline.materials.map((material, sort_order) => ({ material, sort_order })),
      project_steps: entry.baseline.steps.map((step, sort_order) => ({ ...step, sort_order })),
    }
    expect(mapDbProject(row as Parameters<typeof mapDbProject>[0])).toMatchObject(entry.replacement)
    expect(mapProjectWithDetails(row as DbProject)).toMatchObject(entry.replacement)
  })

  it.each([
    { title: '人工改名' }, { category: '新分类' }, { description: '人工修改' },
    { materials: ['新材料'] }, { materials: undefined }, { steps: undefined },
    { steps: [{ title: '新动作', description: '新说明' }] },
    { image: '/uploads/new-photo.jpg' }, { videoUrl: 'https://example.test/new.mp4' },
  ])('does not force replacement after source changes: %j', patch => {
    const source = { ...baseline(entries[0]), ...patch }
    expect(applyProjectSourceTutorial(source)).toBe(source)
    expect(getProjectSourceTutorial(source)).toBeNull()
  })

  it('does not reuse a new video or manually replaced cover through the effective chain', () => {
    const source = baseline(entries[0])
    const video = { ...source, videoUrl: 'https://example.test/new.mp4' }
    expect(applyEffectiveProjectDemonstration(video)).toBe(video)
    const uploaded = { ...source, image: '/uploads/my-new-cover.jpg' }
    expect(applyEffectiveProjectDemonstration(uploaded).image).toBe(uploaded.image)
    expect(applyEffectiveProjectDemonstration(uploaded).description).toBe(uploaded.description)
  })

  it('rejects missing image provenance and impossible crop bounds', () => {
    const entry = structuredClone(entries[0])
    entry.assets[0].crop.width = entry.assets[0].crop.sourceWidth + 1
    expect(isValidSourceTutorial(entry)).toBe(false)
    expect(isValidSourceTutorial({ ...entries[0], assets: [] })).toBe(false)
    const optional = { ...entries[0], replacement: { ...entries[0].replacement, steps: [{ title: '无照片操作', description: '按原教程操作' }] } }
    expect(isValidSourceTutorial(optional)).toBe(true)
    expect(isValidSourceTutorial({ ...optional, downloads: [{ label: '外部模板', path: 'https://example.test/template.pdf' }] })).toBe(false)
  })

  it('preserves later edits to replacement reflection and step photos', () => {
    const project = applyProjectSourceTutorial(baseline(entries[0]))
    const changed = { ...project, reflection: '人工修订总结' }
    expect(applyProjectSourceTutorial(changed)).toBe(changed)
    const photo = { ...project, steps: project.steps?.map((step, index) => index === 0 ? { ...step, image_url: '/uploads/new-step.jpg' } : step) }
    expect(applyProjectSourceTutorial(photo)).toBe(photo)
  })
})

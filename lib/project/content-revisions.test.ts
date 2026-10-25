import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import sourceData from '@/__tests__/fixtures/household-source-509.json'
import caterpillarSource from '@/__tests__/fixtures/household-source-722.json'
import strawMonkeySource from '@/__tests__/fixtures/household-source-902.json'
import paperStarSource from '@/__tests__/fixtures/household-source-806.json'
import revisions from './content-revisions.data.json'
import { applyProjectContentRevision, getProjectRevisionPreparationNotes } from './content-revisions'
import { hashProjectInstructionContent } from './content-fingerprint'
import { prepareHouseholdProject } from '@/lib/explore/household-projects'
import { resolveProjectMaterials } from './materials'

const source: Project = sourceData

describe('source-bound content revisions', () => {
  it('adds water to the legacy needle content without accepting its outdated matching profile', () => {
    const revised = applyProjectContentRevision(source)
    expect(revised.materials).toContain('清水')
    expect(revised.steps).toEqual(source.steps)
    expect(source.materials).not.toContain('清水')
    expect(resolveProjectMaterials(revised).materials).toContain('清水')
    expect(prepareHouseholdProject(source)).toBeNull()
    expect(applyProjectContentRevision(revised)).toBe(revised)
  })

  it.each([
    { title: '新项目标题' },
    { category: '工程' },
    { description: '修改后的介绍' },
    { materials: ['新的材料'] },
    { steps: [{ title: '新的动作', description: '修改后的操作' }] },
  ])('leaves a concurrently edited source untouched: %j', (patch) => {
    const changed = { ...source, ...patch }
    expect(applyProjectContentRevision(changed)).toBe(changed)
    expect(getProjectRevisionPreparationNotes(changed)).toEqual([])
    expect(prepareHouseholdProject(changed)).toBeNull()
  })

  it('retains existing step images when only the materials are corrected', () => {
    const withImage = { ...source, steps: source.steps!.map((step) => ({ ...step, image_url: '/original-step.webp' })) }
    expect(applyProjectContentRevision(withImage).steps?.[0].image_url).toBe('/original-step.webp')
  })

  it.each([caterpillarSource, strawMonkeySource, paperStarSource])('uses source-verified actions for $id and never assigns an old diagram by array position', (input) => {
    const withImages = { ...input, steps: input.steps.map((step) => ({ ...step, image_url: '/old-diagram.webp' })) }
    const revised = applyProjectContentRevision(withImages)
    expect(revised.steps).not.toEqual(input.steps)
    expect(revised.steps?.every((step) => !step.image_url)).toBe(true)
    expect(prepareHouseholdProject(input)).not.toBeNull()
    expect(prepareHouseholdProject({ ...input, steps: [{ title: '新版本', description: '编辑后需重新核对' }] })).toBeNull()
    expect(prepareHouseholdProject({ ...input, videoUrl: 'https://example.com/replaced-video.mp4' })).toBeNull()
  })

  it('keeps a unique, evidenced revision registry with both source and resulting fingerprints', () => {
    expect(new Set(revisions.map((revision) => revision.id)).size).toBe(revisions.length)
    for (const revision of revisions) {
      expect(revision.sourceHash).toMatch(/^[a-f0-9]{64}$/)
      expect(revision.contentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(revision.evidence.length).toBeGreaterThan(0)
    }
    const revision = revisions.find((entry) => entry.id === source.id)!
    expect(hashProjectInstructionContent(source)).toBe(revision.sourceHash)
    expect(hashProjectInstructionContent(applyProjectContentRevision(source))).toBe(revision.contentHash)
  })
})

import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import sourceData from '@/__tests__/fixtures/household-source-509.json'
import caterpillarSource from '@/__tests__/fixtures/household-source-722.json'
import strawMonkeySource from '@/__tests__/fixtures/household-source-902.json'
import paperStarSource from '@/__tests__/fixtures/household-source-806.json'
import fanSource from '@/__tests__/fixtures/project-210.json'
import revisions from './content-revisions.data.json'
import { applyProjectContentRevision, getProjectRevisionPreparationNotes, getProjectRevisionPresentation } from './content-revisions'
import { hashProjectInstructionContent } from './content-fingerprint'
import { prepareHouseholdProject } from '@/lib/explore/household-projects'
import { resolveProjectMaterials } from './materials'
import { getMaterialMeta } from './material-meta'

const source: Project = sourceData

describe('source-bound content revisions', () => {
  it('adds water to the legacy needle content without accepting its outdated matching profile', () => {
    const revised = applyProjectContentRevision(source)
    expect(revised.materials).toContain('清水')
    expect(revised.steps).toEqual(source.steps)
    expect(source.materials).not.toContain('清水')
    expect(resolveProjectMaterials(revised).materials.map(getMaterialMeta)).toContainEqual({ name: '水', amount: '', note: '清水' })
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
    const replacedVideo = { ...input, videoUrl: 'https://example.com/replaced-video.mp4' }
    expect(prepareHouseholdProject(replacedVideo)).toBeNull()
    expect(applyProjectContentRevision(replacedVideo)).toBe(replacedVideo)
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

  it('turns the incomplete fan instructions into nonmutating structure checks', () => {
    const original = structuredClone(fanSource)
    const revised = applyProjectContentRevision(fanSource)
    const revision = revisions.find((entry) => entry.id === 210)!
    expect(fanSource).toEqual(original)
    expect(hashProjectInstructionContent(fanSource)).toBe(revision.sourceHash)
    expect(hashProjectInstructionContent(revised)).toBe(revision.contentHash)
    expect(revised.description).toContain('尚不能作为完整制作教程')
    expect(revised.reflection).toContain('结构核对也不等于实物验证')
    expect(revised.materials).toContain('铅笔（画扇叶）')
    expect(revised.steps?.map((step) => step.title)).toEqual([
      '核对扇叶与转轴', '核对转轴支撑', '核对橡皮筋两端', '确认后再试转',
    ])
    expect(revised.steps?.every((step) => !step.image_url)).toBe(true)
    expect(getProjectRevisionPresentation(fanSource)).toBeNull()
    expect(getProjectRevisionPresentation(revised)).toEqual({
      mode: 'preparation', stepsTitle: '结构核对', notice: '连接细节尚未确认，请先核对结构；本页暂不作为完整制作教程。',
    })
    expect(applyProjectContentRevision(revised)).toBe(revised)
    expect(prepareHouseholdProject(fanSource)).toBeNull()
    expect(prepareHouseholdProject(revised)).toBeNull()
  })

  it.each([
    { title: '新的风扇' },
    { category: '科学' },
    { description: '已经补齐结构的新版本' },
    { materials: ['新材料'] },
    { steps: [{ title: '新的步骤', description: '已核对的新连接' }] },
    { videoUrl: 'https://example.com/new-fan.mp4' },
  ])('does not revise or present an edited fan source/result: %j', (patch) => {
    const changedSource = { ...fanSource, ...patch }
    expect(applyProjectContentRevision(changedSource)).toBe(changedSource)
    expect(getProjectRevisionPresentation(changedSource)).toBeNull()
    const changedResult = { ...applyProjectContentRevision(fanSource), ...patch }
    expect(applyProjectContentRevision(changedResult)).toBe(changedResult)
    expect(getProjectRevisionPresentation(changedResult)).toBeNull()
  })

  it('accepts absent video for the no-video revision and preserves fingerprint semantics for reflection', () => {
    const revised = applyProjectContentRevision({ ...fanSource, videoUrl: undefined })
    expect(getProjectRevisionPresentation(revised)?.mode).toBe('preparation')
    expect(getProjectRevisionPresentation({ ...revised, reflection: '后来编辑的反思' })?.mode).toBe('preparation')
  })

  it.each(['后来编辑的反思', '', undefined, null, `${fanSource.reflection} `])(
    'preserves concurrently edited or missing source reflection: %j', (reflection) => {
      // The fingerprint intentionally excludes reflection; its source guard must still opt out.
      const changed = { ...fanSource, reflection } as Project
      expect(hashProjectInstructionContent(changed)).toBe(hashProjectInstructionContent(fanSource))
      expect(applyProjectContentRevision(changed)).toBe(changed)
      expect(getProjectRevisionPresentation(changed)).toBeNull()
    },
  )
})

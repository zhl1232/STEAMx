import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import * as scienceSamples from '@/lib/project/science-samples'
import { HOUSEHOLD_MATERIALS, matchProjectMaterials } from './material-matching'
import { HOUSEHOLD_PROJECT_IDS, prepareHouseholdProject } from './household-projects'

function project(id: number): Project {
  const sample = scienceSamples.getScienceSample(id)!
  return {
    id, title: sample.title, category: '科学', author: 'Teacher', author_id: 'teacher', image: 'cover.webp', likes: 1,
    description: '数据库旧正文', materials: ['数据库旧材料包'],
    steps: [{ title: '观看实验视频', description: '请准备好对应实验材料包，跟随本页视频完成操作。' }],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('prepareHouseholdProject', () => {
  it('includes exactly the reviewed live cohort and confirms their required type counts', () => {
    expect(HOUSEHOLD_PROJECT_IDS).toEqual([586, 624, 717, 738, 745, 763, 812, 867, 1049, 1157])
    const allOwned = HOUSEHOLD_MATERIALS.map(({ id }) => id)
    expect(HOUSEHOLD_PROJECT_IDS.map((id) => {
      const prepared = prepareHouseholdProject(project(id))!
      return matchProjectMaterials(prepared.materials, allOwned)
    })).toEqual([5, 1, 3, 4, 2, 3, 2, 4, 4, 5].map((count) => ({
      requiredCount: count, ownedCount: count, missingLabels: [], hasSelection: true,
    })))
  })

  it.each(['production', 'development'])('uses effective published science materials rather than stale database rows in %s', (env) => {
    vi.stubEnv('NODE_ENV', env)
    const original = project(586)
    const prepared = prepareHouseholdProject(original)!
    expect(prepared.materials).toContain('气球1个')
    expect(prepared.materials).toContain('打气筒（建议使用）')
    expect(prepared.materials).not.toContain('两处稳固的绳端固定点')
    expect(prepared.description).toBe(scienceSamples.getScienceSample(586)!.description)
    expect(original.materials).toEqual(['数据库旧材料包'])
    expect(original.description).toBe('数据库旧正文')
  })

  it.each([{ title: '改名后的项目' }, { category: '工程' }, { category: '艺术' }])('rejects a changed reviewed identity: %j', (patch) => {
    expect(prepareHouseholdProject({ ...project(738), ...patch })).toBeNull()
  })

  it.each([102, 103, 552, 675, 949, 1188])('does not enroll mock, preparation, viewing or unreviewed household candidates: %s', (id) => {
    const input = { ...project(738), id, materials: ['纸杯'] }
    expect(prepareHouseholdProject(input)).toBeNull()
  })

  it.each(['preparation', 'observation'] as const)('fails closed if a cohort source changes to %s', (mode) => {
    const input = project(738)
    const sample = scienceSamples.getScienceSample(738)!
    vi.spyOn(scienceSamples, 'getScienceSampleForProject').mockReturnValue({ ...sample, mode })
    expect(prepareHouseholdProject(input)).toBeNull()
  })

  it('fails closed if a cohort source develops an instruction gap', () => {
    const input = project(738)
    vi.spyOn(scienceSamples, 'getScienceSampleForProject').mockReturnValue({
      ...scienceSamples.getScienceSample(738)!, instructionGap: '折法依赖说明书',
    })
    expect(prepareHouseholdProject(input)).toBeNull()
  })

  it('requires an explicitly reviewed source even when the ID is in the cohort', () => {
    vi.spyOn(scienceSamples, 'isReviewedScienceProject').mockReturnValue(false)
    expect(prepareHouseholdProject(project(738))).toBeNull()
  })

  it.each([{ materials: [] }, { materials: ['清水', '新的未知材料'] }])('fails closed when effective requirements become empty or unknown: %j', ({ materials }) => {
    const effective = scienceSamples.applyScienceSample(project(738))
    vi.spyOn(scienceSamples, 'applyScienceSample').mockReturnValue({ ...effective, materials })
    expect(prepareHouseholdProject(project(738))).toBeNull()
  })

  it.each([
    { steps: [] },
    { steps: [{ title: '观看实验视频', description: '请准备好对应实验材料包，跟随本页视频完成操作。' }] },
    { steps: [{ title: '开始操作', description: '   ' }] },
  ])('requires concrete instructions in effective content: %j', ({ steps }) => {
    const effective = scienceSamples.applyScienceSample(project(738))
    vi.spyOn(scienceSamples, 'applyScienceSample').mockReturnValue({ ...effective, steps })
    expect(prepareHouseholdProject(project(738))).toBeNull()
  })
})

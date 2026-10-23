import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import * as scienceSamples from '@/lib/project/science-samples'
import { HOUSEHOLD_MATERIALS, matchProjectMaterials, validateMaterialRequirements } from './material-matching'
import { HOUSEHOLD_PROJECT_IDS, prepareHouseholdProject } from './household-projects'
import profilesData from './household-projects.data.json'
import * as householdProfile from '@/lib/project/household-profile'

const crossCategoryProjects: Project[] = [
  {
    "id": 291,
    "title": "树叶拓印画",
    "category": "艺术",
    "description": "收集各种形状的树叶，用颜料将叶脉纹理拓印到纸上，制作一幅自然之美的作品。在创作中感受大自然的丰富形态，学习拓印这种古老的艺术技法。",
    "materials": [
      "各种形状的新鲜树叶",
      "水粉颜料或丙烯颜料",
      "小刷子或海绵",
      "白色卡纸",
      "旧报纸"
    ],
    "steps": [
      {
        "title": "采集树叶",
        "description": "到户外收集不同形状和大小的树叶，选择叶脉清晰、表面平整的叶子效果最佳。"
      },
      {
        "title": "涂抹颜料",
        "description": "在树叶叶脉突出的背面均匀涂上颜料，注意不要涂得太厚。"
      },
      {
        "title": "拓印成画",
        "description": "将涂好颜料的叶面朝下放在卡纸上，用手轻轻按压叶子的每个部分，然后小心揭起。"
      },
      {
        "title": "组合构图",
        "description": "用不同大小和颜色的叶子拓印出树木、花朵或抽象风景画面。"
      },
      {
        "title": "添加细节",
        "description": "用画笔添加树干、花茎或小昆虫等细节，完善整幅作品。"
      }
    ],
    "author": "Teacher",
    "author_id": "teacher",
    "image": "cover.webp",
    "likes": 1
  },
  {
    "id": 353,
    "title": "找找生活中的几何",
    "category": "数学",
    "description": "带着\"几何之眼\"在家里和户外寻找各种几何图形，记录它们藏在哪里。你将惊喜地发现圆形、三角形、长方形无处不在，从窗户到车轮，从蜂巢到路标，几何就在身边。",
    "materials": [
      "记录本",
      "彩色铅笔",
      "手机或相机（可选）"
    ],
    "steps": [
      {
        "title": "室内寻宝",
        "description": "在家中寻找各种几何图形：窗户是什么形状？钟面是什么形状？把找到的图形画在记录本上。"
      },
      {
        "title": "户外探索",
        "description": "到户外散步，观察建筑、路标、井盖、花朵中隐藏的几何图形，用手机拍照或速写记录。"
      },
      {
        "title": "分类整理",
        "description": "将找到的图形按类别整理：圆形、三角形、四边形、多边形等，统计每种图形出现的次数。"
      },
      {
        "title": "制作几何图鉴",
        "description": "选出最有趣的发现，配上图画和文字说明，制作一本属于自己的\"生活几何图鉴\"。"
      }
    ],
    "author": "Teacher",
    "author_id": "teacher",
    "image": "cover.webp",
    "likes": 1
  }
]

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
  it('keeps the falling-cup activity on its paper-cup branch and the basic track free of hot glue', () => {
    const fallingCup = profilesData.find((profile) => profile.id === 534)!
    const ownedExceptPaperCup = HOUSEHOLD_MATERIALS.filter((material) => material.id !== 'paper-cup').map((material) => material.id)
    expect(matchProjectMaterials([], ownedExceptPaperCup, fallingCup.required)?.missingLabels).toEqual(['纸杯'])
    const track = profilesData.find((profile) => profile.id === 215)!
    const hotGlueId = HOUSEHOLD_MATERIALS.find((material) => material.label === '热熔胶')!.id
    expect(track.required.flat()).not.toContain(hotGlueId)
  })

  it('requires a measuring spoon for the bubble recipe even when every other material is owned', () => {
    const recipe = profilesData.find((profile) => profile.id === 39)!
    const owned = HOUSEHOLD_MATERIALS.filter((material) => !['勺子', '取样勺'].includes(material.label)).map((material) => material.id)
    const match = matchProjectMaterials([], owned, recipe.required)!
    expect(match.missingLabels).toHaveLength(1)
    expect(['勺子', '取样勺']).toContain(match.missingLabels[0])
  })

  it('requires a cup for the dough ratio and cotton rope for the paper hand', () => {
    const dough = profilesData.find((profile) => profile.id === 332)!
    const cupLabels = ['杯子', '纸杯', '量杯', '透明量杯']
    const withoutCups = HOUSEHOLD_MATERIALS.filter((material) => !cupLabels.includes(material.label)).map((material) => material.id)
    const doughMatch = matchProjectMaterials([], withoutCups, dough.required)!
    expect(doughMatch.missingLabels).toHaveLength(1)
    expect(cupLabels).toContain(doughMatch.missingLabels[0])
    const hand = profilesData.find((profile) => profile.id === 784)!
    const withoutRope = HOUSEHOLD_MATERIALS.filter((material) => material.label !== '棉绳').map((material) => material.id)
    expect(matchProjectMaterials([], withoutRope, hand.required)?.missingLabels).toEqual(['棉绳'])
  })
  it('keeps every enrolled profile valid against the shared catalog', () => {
    expect(new Set(HOUSEHOLD_PROJECT_IDS).size).toBe(HOUSEHOLD_PROJECT_IDS.length)
    for (const profile of profilesData) {
      expect(validateMaterialRequirements(profile.required), `project ${profile.id}`).not.toBeNull()
      expect(profile.contentHash, `project ${profile.id}`).toMatch(/^[a-f0-9]{64}$/u)
      const noOwned = matchProjectMaterials([], [], profile.required)!
      const allOwned = matchProjectMaterials([], HOUSEHOLD_MATERIALS.map(({ id }) => id), profile.required)!
      expect(noOwned, `project ${profile.id}`).not.toBeNull()
      expect(allOwned.missingLabels, `project ${profile.id}`).toEqual([])
      expect(allOwned.requiredCount, `project ${profile.id}`).toBe(noOwned.requiredCount)
    }
  })
  it.each(crossCategoryProjects)('enrolls the authentic $category project $id with unchanged complete materials', (input) => {
    const prepared = prepareHouseholdProject(input)!
    expect(prepared).not.toBeNull()
    expect(prepared.materials).toEqual(input.materials)
    expect(prepared.householdRequirements).not.toHaveLength(0)
    expect(matchProjectMaterials(prepared.materials, [], prepared.householdRequirements)).not.toBeNull()
    expect(householdProfile.hashHouseholdProjectContent(input)).toBe(profilesData.find((profile) => profile.id === input.id)!.contentHash)
  })

  it.each(crossCategoryProjects)('stops enrolling raw project $id when its instructions change', (input) => {
    expect(prepareHouseholdProject({ ...input, steps: [{ ...input.steps![0], description: '新的操作' }] })).toBeNull()
  })
  it('retains the original ten projects and their required type counts in the expanded cohort', () => {
    const originalCohort = [586, 624, 717, 738, 745, 763, 812, 867, 1049, 1157]
    expect(HOUSEHOLD_PROJECT_IDS).toEqual(profilesData.map((profile) => profile.id))
    expect(HOUSEHOLD_PROJECT_IDS).toEqual(expect.arrayContaining(originalCohort))
    const allOwned = HOUSEHOLD_MATERIALS.map(({ id }) => id)
    expect(originalCohort.map((id) => {
      const prepared = prepareHouseholdProject(project(id))!
      return matchProjectMaterials(prepared.materials, allOwned, prepared.householdRequirements)
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

  it.each([[], [[]], [['unknown-material']]].map((required) => ({ required })))('rejects invalid profile clauses even when its identity/content matched: $required', ({ required }) => {
    const profile = householdProfile.getHouseholdProfile(scienceSamples.applyScienceSample(project(738)))!
    vi.spyOn(householdProfile, 'getHouseholdProfile').mockReturnValue({ ...profile, required: required as string[][] })
    expect(prepareHouseholdProject(project(738))).toBeNull()
  })

  it('uses the specified canonical content hash and keeps display metadata outside it', () => {
    const effective = scienceSamples.applyScienceSample(project(738))
    const profile = householdProfile.getHouseholdProfile(effective)!
    expect(profile).not.toBeNull()
    expect(householdProfile.hashHouseholdProjectContent(effective)).toBe(profile.contentHash)
    expect(householdProfile.getHouseholdProfile({ ...effective, likes: 99, image: 'new-cover.webp' })).toBe(profile)
  })

  it.each(['safety', 'faq', 'sourceRelation'] as const)('invalidates profiles when source %s changes', (field) => {
    const effective = scienceSamples.applyScienceSample(project(738))
    const sample = scienceSamples.getScienceSampleForProject(effective)!
    vi.spyOn(scienceSamples, 'getScienceSampleForProject').mockReturnValue({
      ...sample,
      ...(field === 'safety' ? { safety: `${sample.safety} 新防护条件` } : {}),
      ...(field === 'faq' ? { faq: [{ question: '新问题', answer: '新操作说明' }] } : {}),
      ...(field === 'sourceRelation' ? { sourceRelation: sample.sourceRelation === 'alternative' ? undefined : 'alternative' as const } : {}),
    })
    expect(householdProfile.getHouseholdProfile(effective)).toBeNull()
  })

  it.each(['title', 'category', 'description', 'materials', 'steps'] as const)('invalidates a profile when effective %s changes', (field) => {
    const effective = scienceSamples.applyScienceSample(project(738))
    const changed = {
      ...effective,
      ...(field === 'title' ? { title: '不同标题' } : {}),
      ...(field === 'category' ? { category: '艺术' } : {}),
      ...(field === 'description' ? { description: `${effective.description}新增正文` } : {}),
      ...(field === 'materials' ? { materials: [...effective.materials!, '新材料'] } : {}),
      ...(field === 'steps' ? { steps: [{ ...effective.steps![0], description: '已修改实际动作' }, ...effective.steps!.slice(1)] } : {}),
    }
    expect(householdProfile.getHouseholdProfile(changed)).toBeNull()
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

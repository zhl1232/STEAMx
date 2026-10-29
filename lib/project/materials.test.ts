import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import fixtures from '@/__tests__/fixtures/project-video-pilot.json'
import { applyScienceSample, getScienceSample } from './science-samples'
import { resolveProjectMaterials } from './materials'
import { getMaterialMeta } from './material-meta'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'
import * as householdProfile from './household-profile'

afterEach(() => vi.restoreAllMocks())

const base: Project = { id: 586, title: '气球缆车', category: '科学', author: '', author_id: '', image: '', likes: 0 }

const parachute: Project = { ...base, ...{
  "id": 791,
  "title": "空降伞兵",
  "category": "科学",
  "description": "科学原理：伞面增加自由落体下降时的阻力，减小下降时的速度，使人下降到地面的速度，成为人体能够承受的速度。利用空气阻力原理，依靠相对于空气运动充气展开的可展式气动力减速器。",
  "materials": [
    "色素",
    "自备（双面胶、棉绳1.5米、厚方便袋、剪刀）"
  ],
  "steps": [
    {
      "title": "步骤 1",
      "description": "取塑料袋剪成直径25厘米弧边正方形。"
    },
    {
      "title": "步骤 2",
      "description": "将绳子剪成两根50厘米，将塑料纸一个角对折，把绳子一头粘在夹角里。"
    },
    {
      "title": "步骤 3",
      "description": "依次将4个角与绳子交叉连接粘牢。"
    },
    {
      "title": "步骤 4",
      "description": "在绳子中间交汇处系上一瓶色素或其他配重物。降落伞就可以抛高了。"
    }
  ]
} }

const geometry: Project = { ...base, ...{
  "id": 354,
  "title": "用积木搭几何体",
  "category": "数学",
  "description": "用积木搭建正方体、长方体、三棱柱等基本几何体，从不同角度观察它们的形状。你通过动手搭建获得对立体图形的直觉认识，学会数面、棱和顶点的数量。",
  "materials": [
    "积木或方块若干",
    "橡皮泥",
    "牙签或竹签",
    "记录本和铅笔"
  ],
  "steps": [
    {
      "title": "搭建基本体",
      "description": "用积木搭出正方体和长方体，数一数它们各有几个面、几条棱、几个顶点。"
    },
    {
      "title": "制作棱柱",
      "description": "用橡皮泥做顶点、牙签做棱，搭出三棱柱和四棱柱的骨架模型，感受立体结构。"
    },
    {
      "title": "多角度观察",
      "description": "从正面、侧面和上方分别观察同一个几何体，画出每个角度看到的平面图形。"
    },
    {
      "title": "搭建挑战",
      "description": "尝试用积木搭出金字塔（四棱锥）形状，讨论它与长方体在面和棱上的不同之处。"
    },
    {
      "title": "记录与比较",
      "description": "把每种几何体的面数、棱数和顶点数记录在表格里，看看能否发现数量之间的规律。"
    }
  ]
} }

describe('resolveProjectMaterials', () => {
  it('adds profile preparation notes only while the original effective content hash matches', () => {
    const effective = applyScienceSample(base)
    const originalGetter = householdProfile.getHouseholdProfile
    vi.spyOn(householdProfile, 'getHouseholdProfile').mockImplementation((project) => {
      const profile = originalGetter(project)
      return profile ? { ...profile, preparationNotes: ['先清理操作台，并准备接水空间。'] } : null
    })
    expect(resolveProjectMaterials(effective).preparationNotes).toContain('先清理操作台，并准备接水空间。')
    expect(resolveProjectMaterials({ ...effective, description: '已修改活动内容' }).preparationNotes).not.toContain('先清理操作台，并准备接水空间。')
    expect(resolveProjectMaterials(effective).materials).toEqual(['气球1个', '吸管1根（直吸管）', '绳子（细绳）', '双面胶', '剪刀', '打气筒（建议使用）'])
    expect(resolveProjectMaterials(effective).preparationNotes).toContain('剪刀：成人使用。')
  })
  it('retains quantities and optional materials while separating setup requirements', () => {
    const project = applyScienceSample(base)
    const original = [...project.materials!]
    const result = resolveProjectMaterials(project)
    expect(result.materials).toContain('气球1个')
    expect(result.materials).toContain('打气筒（建议使用）')
    expect(result.materials).not.toContain('两处稳固的绳端固定点')
    expect(result.preparationNotes).toEqual(expect.arrayContaining([expect.stringContaining('两把稳固椅子的椅背')]))
    expect(new Set(result.preparationNotes).size).toBe(result.preparationNotes.length)
    expect(project.materials).toEqual(original)
    expect(getScienceSample(586)!.materials).toContain('两处稳固的绳端固定点')
  })

  it('rejoins imported rows split within parentheses without dropping content', () => {
    expect(resolveProjectMaterials({ ...base, materials: ['色素', '自备（纯牛奶', '洗洁精', '盘子）', '滴管'] })).toEqual({
      materials: ['色素', '牛奶（纯牛奶）', '洗洁精', '盘子', '滴管'], preparationNotes: [],
    })
  })

  it('keeps the reviewed video pilot materials as the effective material source', () => {
    const motor = fixtures[0] as Project
    expect(resolveProjectMaterials(motor).materials).toEqual(getProjectVideoPresentationPilot(motor)!.materials)
    expect(resolveProjectMaterials({ ...motor, title: '已改名' }).materials.map(getMaterialMeta)).toEqual(motor.materials!.map(getMaterialMeta))
  })

  it('clarifies a pigment bottle used as a counterweight only for the unchanged reviewed source', () => {
    expect(householdProfile.getHouseholdProfile(parachute)).not.toBeNull()
    const before = structuredClone(parachute)
    expect(resolveProjectMaterials(parachute).materials).toContain('配重物（可用一瓶色素或其他配重物）')
    expect(resolveProjectMaterials(parachute).materials.map(getMaterialMeta)).toContainEqual(expect.objectContaining({ name: '塑料袋', note: expect.stringContaining('厚') }))
    expect(parachute).toEqual(before)
    expect(resolveProjectMaterials({ ...parachute, description: '修改后的活动' }).materials).toContain('色素')
    expect(resolveProjectMaterials({ ...parachute, title: '不同项目' }).materials).toContain('色素')
    expect(resolveProjectMaterials({ ...parachute, id: 792 }).materials).toContain('色素')
    expect(resolveProjectMaterials({ ...parachute, materials: ['其他载荷'] }).materials).toEqual(['其他载荷'])
  })

  it('collapses a source-confirmed block synonym only for the qualified geometry project', () => {
    expect(householdProfile.getHouseholdProfile(geometry)).not.toBeNull()
    const before = structuredClone(geometry)
    const result = resolveProjectMaterials(geometry)
    expect(result.materials).toContain('积木若干')
    expect(result.materials.join(' ')).not.toContain('方块')
    expect(result.preparationNotes.join(' ')).toContain('可搭正方体/长方体的积木')
    expect(result.preparationNotes.join(' ')).not.toContain('积木或方块')
    expect(geometry).toEqual(before)
    expect(resolveProjectMaterials({ ...geometry, description: '已修改' }).materials).toContain('积木或方块若干')
    expect(resolveProjectMaterials({ ...geometry, id: 355 }).materials).toContain('积木或方块若干')
  })

  it('handles absent materials without inventing requirements', () => {
    expect(resolveProjectMaterials(base)).toEqual({ materials: [], preparationNotes: [] })
  })
})

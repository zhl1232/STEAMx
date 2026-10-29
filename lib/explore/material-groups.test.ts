import { describe, expect, it } from 'vitest'
import catalog from './household-materials.data.json'
import profiles from './household-projects.data.json'
import { HOUSEHOLD_MATERIAL_GROUPS, getMaterialGroupId, getMaterialSelectionCount } from './material-groups'
import { matchProjectMaterials, normalizeOwnedMaterialIds, sortProjectsByMaterials, validateMaterialRequirements } from './material-matching'

const id = (label: string) => catalog.find((material) => material.label === label)!.id

describe('household material families', () => {
  it('groups the geometric building blocks while preserving former singleton selections', () => {
    const block = id('积木'), cube = id('方块')
    const groupId = getMaterialGroupId(block)!
    const group = HOUSEHOLD_MATERIAL_GROUPS.find(({ id }) => id === groupId)!
    expect(groupId).toBe(`group:${block}`)
    expect(getMaterialGroupId(cube)).toBe(groupId)
    expect(group.label).toBe('积木')
    expect(group.aliases).toContain('方块')
    expect(getMaterialGroupId(`group:${cube}`)).toBe(groupId)
    expect(normalizeOwnedMaterialIds([`group:${block}`, `group:${cube}`])).toEqual([groupId])
    expect(normalizeOwnedMaterialIds([block, cube, `group:${cube}`])).toEqual([cube, block, groupId])
    expect(getMaterialGroupId('group:unknown')).toBeUndefined()
    expect(normalizeOwnedMaterialIds(['group:unknown', 'group:group:water'])).toEqual([])
    const project = profiles.find(({ id }) => id === 354)!
    expect(project.required).toContainEqual([block, cube])
    const otherMaterials = project.required.filter((group) => !group.includes(block)).flat()
    expect(matchProjectMaterials([], [...otherMaterials, `group:${cube}`], project.required)).toMatchObject({ missingLabels: [] })
    expect(matchProjectMaterials([], [...otherMaterials, `group:${cube}`], project.required)).not.toHaveProperty('pendingLabels')
    expect(matchProjectMaterials([], [...otherMaterials, cube], project.required)).not.toHaveProperty('pendingLabels')
  })
  it('covers every legacy identity exactly once with unique short labels', () => {
    expect(new Set(HOUSEHOLD_MATERIAL_GROUPS.map(({ id }) => id)).size).toBe(HOUSEHOLD_MATERIAL_GROUPS.length)
    expect(new Set(HOUSEHOLD_MATERIAL_GROUPS.map(({ label }) => label)).size).toBe(HOUSEHOLD_MATERIAL_GROUPS.length)
    const members = HOUSEHOLD_MATERIAL_GROUPS.flatMap(({ memberIds }) => memberIds)
    expect(new Set(members).size).toBe(catalog.length)
    expect(members).toHaveLength(catalog.length)
    for (const group of HOUSEHOLD_MATERIAL_GROUPS) {
      expect(group.id).toMatch(/^group:/)
      expect(group.label).not.toMatch(/[（(]/)
      for (const member of group.memberIds) expect(getMaterialGroupId(member)).toBe(group.id)
    }
  })

  it('keeps exact legacy specifications while counting one household family', () => {
    const exact = [id('1元硬币'), id('1角硬币')]
    expect(normalizeOwnedMaterialIds([...exact, 'group:coin', 'group:coin', 'unknown'])).toEqual([exact[1], exact[0], 'group:coin'])
    expect(getMaterialSelectionCount([...exact, 'group:coin'])).toBe(1)
    expect(validateMaterialRequirements([['group:coin']])).toBeNull()
  })

  it('distinguishes missing, category-owned, and confirmed specifications', () => {
    const requirements = [[id('塑料瓶（宽口，可放乒乓球）')]]
    expect(matchProjectMaterials([], [], requirements)).toMatchObject({ requiredCount: 1, ownedCount: 0 })
    expect(matchProjectMaterials([], ['group:bottle'], requirements)).toEqual({ requiredCount: 1, ownedCount: 1, missingLabels: [], pendingLabels: ['瓶子'], hasSelection: true })
    expect(matchProjectMaterials([], ['group:bottle', requirements[0][0]], requirements)).toEqual({ requiredCount: 1, ownedCount: 1, missingLabels: [], hasSelection: true })
    expect(matchProjectMaterials([], ['group:bottle'], [[id('瓶子')]])).not.toHaveProperty('pendingLabels')
  })

  it('does not mistake water for a loaded bottle or for a required temperature', () => {
    const filledBottle = [[id('瓶装清水')]]
    expect(matchProjectMaterials([], ['group:water'], filledBottle)).toMatchObject({ ownedCount: 0, missingLabels: ['瓶子'] })
    expect(matchProjectMaterials([], ['group:bottle'], filledBottle)).toMatchObject({ missingLabels: [], pendingLabels: ['瓶子'] })
    expect(matchProjectMaterials([], ['group:water'], [[id('热水')]])).toMatchObject({ missingLabels: [], pendingLabels: ['水'] })
    expect(matchProjectMaterials([], ['group:water'], [['water']])).not.toHaveProperty('pendingLabels')
  })

  it('retains all different specifications in an AND clause while counting the family once', () => {
    const one = id('1元硬币'), small = id('1角硬币')
    const required = [[one], [small]]
    expect(matchProjectMaterials([], ['group:coin', one], required)).toMatchObject({ requiredCount: 1, ownedCount: 1, pendingLabels: ['硬币'] })
    expect(matchProjectMaterials([], [one, small], required)).toEqual({ requiredCount: 1, ownedCount: 1, missingLabels: [], hasSelection: true })
    expect(matchProjectMaterials([], [], required)).toMatchObject({ requiredCount: 1, ownedCount: 0 })
  })

  it('prefers confirmed OR branches and preserves conjunctive dependencies', () => {
    const one = id('1元硬币'), small = id('1角硬币')
    const groups = [[one, 'water'], [small, 'water']]
    expect(matchProjectMaterials([], ['group:coin', one, 'water'], groups)).toEqual({ requiredCount: 1, ownedCount: 1, missingLabels: [], hasSelection: true })
    expect(matchProjectMaterials([], ['group:coin', one], groups)).toMatchObject({ requiredCount: 1, ownedCount: 1, pendingLabels: ['硬币'] })
    const cards = [
      { id: 'pending', householdRequirements: [[small]] },
      { id: 'missing', householdRequirements: [['scissors']] },
      { id: 'confirmed', householdRequirements: [[one]] },
    ]
    expect(sortProjectsByMaterials(cards, ['group:coin', one]).map(({ id }) => id)).toEqual(['confirmed', 'pending', 'missing'])
  })
  it('does not report the already confirmed pencil grade as pending', () => {
    const hb = id('HB铅笔'), twoB = id('2B铅笔')
    expect(matchProjectMaterials([], [hb], [[twoB], [hb]])).toEqual({
      requiredCount: 1, ownedCount: 1, missingLabels: [], pendingLabels: ['铅笔'], hasSelection: true,
    })
  })

  it('agrees with exhaustive family-state optima across overlapping AND/OR branches', () => {
    const ids = [id('1元硬币'), id('1角硬币'), 'water', 'scissors']
    const candidateSets = Array.from({ length: 16 }, (_, mask) => ids.filter((_, index) => mask & (1 << index)))
    for (let seed = 1; seed <= 24; seed++) {
      const requirements = [seed % 15 + 1, (seed * 3) % 15 + 1, (seed * 7) % 15 + 1].map((mask) => candidateSets[mask])
      for (let mask = 0; mask < 32; mask++) {
        const owned = [...candidateSets[mask % 16], ...(mask & 16 ? ['group:coin'] : [])]
        const score = (selected: string[]) => {
          const families = new Map<string, number>()
          for (const material of selected) {
            const family = getMaterialGroupId(material)!
            const hasFamily = owned.some((value) => getMaterialGroupId(value) === family)
            const state = owned.includes(material) ? 0 : hasFamily ? 1 : 2
            families.set(family, Math.max(families.get(family) ?? 0, state))
          }
          return [[...families.values()].filter((state) => state === 2).length, [...families.values()].filter((state) => state === 1).length, families.size]
        }
        const expected = candidateSets.filter((selected) => requirements.every((group) => group.some((material) => selected.includes(material))))
          .map(score).sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2])[0]
        const actual = matchProjectMaterials([], owned, requirements)!
        expect([actual.missingLabels.length, actual.pendingLabels?.length ?? 0, actual.requiredCount]).toEqual(expected)
      }
    }
  })

  it('matches the complete reviewed cohort with category ownership', () => {
    const owned = HOUSEHOLD_MATERIAL_GROUPS.map(({ id }) => id)
    for (const profile of profiles) {
      const result = matchProjectMaterials([], owned, profile.required)!
      expect(result, `project ${profile.id}`).not.toBeNull()
      expect(result.missingLabels, `project ${profile.id}`).toEqual([])
    }
  })

  it('groups phone and ordinary flashlights without assuming identical operation requirements', () => {
    const phoneLight = id('手机手电筒'), torch = id('手电筒')
    expect(getMaterialGroupId(phoneLight)).toBe('group:flashlight')
    expect(getMaterialGroupId(torch)).toBe('group:flashlight')
    expect(normalizeOwnedMaterialIds([phoneLight, 'group:flashlight'])).toEqual([phoneLight, 'group:flashlight'])
    expect(matchProjectMaterials([], ['group:flashlight'], [[phoneLight]])).toEqual({ requiredCount: 1, ownedCount: 1, missingLabels: [], pendingLabels: ['手电筒'], hasSelection: true })
    expect(matchProjectMaterials([], ['group:flashlight'], [[torch]])).not.toHaveProperty('pendingLabels')
    expect(matchProjectMaterials([], [phoneLight], [[phoneLight]])).not.toHaveProperty('pendingLabels')
    expect(getMaterialGroupId(id('手机（慢动作录像）'))).toBe('group:phone')
    expect(matchProjectMaterials([], ['group:phone'], [[id('手机（慢动作录像）')]])).toMatchObject({ pendingLabels: ['手机'] })
  })

  it.each([
    ['塑料袋', '塑料垃圾袋', '塑料袋'],
    ['塑料袋', '厚塑料袋', '塑料袋'],
    ['木棍', '小木棍', '木棍'],
    ['搅拌棒', '长搅拌棒', '搅拌工具'],
    ['碗', '不透明碗', '碗'],
    ['鞋盒', '带盖鞋盒', '纸盒'],
    ['胶带', '防水胶带', '胶带'],
    ['夹子', '耐热金属夹子', '夹子'],
    ['大透明塑料盒', '长形塑料保鲜盒', '塑料盒'],
  ])('groups %s and %s while retaining specific requirements', (generic, specific, label) => {
    const base = id(generic), spec = id(specific)
    const groupId = getMaterialGroupId(base)!
    expect(getMaterialGroupId(spec)).toBe(groupId)
    expect(HOUSEHOLD_MATERIAL_GROUPS.find(({ id }) => id === groupId)!.label).toBe(label)
    expect(normalizeOwnedMaterialIds([`group:${base}`, `group:${spec}`])).toEqual([groupId])
    expect(matchProjectMaterials([], [groupId], [[spec]])).toMatchObject({ missingLabels: [], pendingLabels: [label] })
    expect(matchProjectMaterials([], [spec], [[spec]])).not.toHaveProperty('pendingLabels')
  })

  it('keeps distinct materials and unspecified collection tools separate', () => {
    for (const [left, right] of [['塑料袋', '收集袋'], ['塑料袋', '方便面袋'], ['木棍', '雪糕棒'], ['胶带', '双面胶'], ['搅拌棒', '玻璃棒'], ['棉绳', '麻绳']]) {
      expect(getMaterialGroupId(id(left))).not.toBe(getMaterialGroupId(id(right)))
    }
  })

  it.each([['夹子', '夹冰工具']])('keeps %s from automatically confirming %s despite sharing a family', (generic, specific) => {
    expect(getMaterialGroupId(id(generic))).toBe(getMaterialGroupId(id(specific)))
    expect(matchProjectMaterials([], [id(generic)], [[id(specific)]])).toMatchObject({ missingLabels: [], pendingLabels: [generic] })
  })

  it('restores material-specific singleton categories after correcting an overly narrow family', () => {
    for (const label of ['擦干用品', '密封盒', '酸奶盒', '透明片', '玻璃棒', '耐热托盘']) {
      const exact = id(label), restored = getMaterialGroupId(`group:${exact}`)!
      expect(restored).toBe(getMaterialGroupId(exact))
      expect(normalizeOwnedMaterialIds([`group:${exact}`])).toEqual([restored])
      expect(matchProjectMaterials([], [exact], [[exact]])).not.toHaveProperty('pendingLabels')
    }
    expect(getMaterialGroupId(id('玻璃棒'))).not.toBe(getMaterialGroupId(id('搅拌用具')))
    expect(getMaterialGroupId(id('透明片'))).not.toBe(getMaterialGroupId(id('塑料纸')))
    expect(getMaterialGroupId(id('耐热托盘'))).not.toBe(getMaterialGroupId(id('烤盘')))
    const mixingTools = getMaterialGroupId(id('搅拌用具'))!
    expect(matchProjectMaterials([], [mixingTools], [[id('搅拌用具')]])).not.toHaveProperty('pendingLabels')
    expect(matchProjectMaterials([], [mixingTools], [[id('搅拌棒')]])).toMatchObject({ pendingLabels: ['搅拌工具'] })
  })

})

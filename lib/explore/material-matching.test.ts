import { describe, expect, it } from 'vitest'
import materialCatalog from './household-materials.data.json'
import {
  HOUSEHOLD_MATERIALS,
  matchProjectMaterials,
  normalizeOwnedMaterialIds,
  getMaterialGroupId,
  HOUSEHOLD_MATERIAL_GROUPS,
  sortProjectsByMaterials,
  splitMaterialPreparation,
  validateMaterialRequirements,
} from './material-matching'

const projects = [
  { id: 102, materials: ['纸杯', '橡皮泥', '贴纸'] },
  { id: 103, materials: ['毛线', '针', '剪刀'] },
  { id: 738, materials: ['纸巾1张', '水溶性水彩笔数色', '浅盘1个', '清水'] },
  { id: 586, materials: ['气球1个', '直吸管1根', '细绳', '双面胶', '两处稳固的绳端固定点', '剪刀（成人使用）', '打气筒（建议使用）'] },
  { id: 1157, materials: ['带盖透明塑料瓶1个', '清水', '少量牛奶', '手机手电筒（成人保管）', '擦水布'] },
]

describe('normalizeOwnedMaterialIds', () => {
  it.each([null, undefined, 1, 'water', '["water"]', { water: true }])('rejects non-array storage values: %j', (value) => {
    expect(normalizeOwnedMaterialIds(value)).toEqual([])
  })

  it('keeps known unique IDs in catalog order without coercing values', () => {
    expect(normalizeOwnedMaterialIds(['milk', 'water', 'water', 'anchors', 'unknown', 1, null, 'Water', ' water'])).toEqual(['water', 'milk'])
  })

  it('restores old color selections as one material and preserves their searchable names', () => {
    const oldPens = materialCatalog.filter(({ label }) => /^彩色笔/u.test(label))
    const pen = HOUSEHOLD_MATERIALS.find(({ label }) => label === '彩色笔')!
    expect(normalizeOwnedMaterialIds(oldPens.map(({ id }) => id))).toEqual([pen.id])
    expect(HOUSEHOLD_MATERIALS.filter(({ label }) => /^彩色笔/u.test(label))).toEqual([pen])
    expect(pen.aliases).toContain('彩色笔（黑红橙）')
  })

  it('retains every reviewed old ID without dangling aliases or alias chains', () => {
    for (const material of materialCatalog) {
      const normalized = normalizeOwnedMaterialIds([material.id])
      expect(normalized, material.label).toHaveLength(1)
      expect(normalizeOwnedMaterialIds(normalized)).toEqual(normalized)
      expect(validateMaterialRequirements([[material.id]])).toEqual([normalized])
    }
  })
})

describe('matchProjectMaterials', () => {
  it.each([
    ['彩色笔', '彩色笔（多色）', '彩色笔（四种颜色）'],
    ['超轻黏土', '超轻黏土（红粉黄棕）', '超轻黏土（绿粉紫棕）'],
    ['水溶性色素', '水溶性色素（多色）', '水溶性色素（红蓝）'],
    ['丙烯颜料', '丙烯颜料（多色）', '丙烯颜料（黄橙粉蓝绿）'],
    ['木棍', '木棒'],
    ['积木', '积木块'],
  ])('counts reviewed variants of %s once in old project requirements', (...labels) => {
    const ids = labels.map((label) => materialCatalog.find((material) => material.label === label)!.id)
    expect(matchProjectMaterials([], [ids[1]], ids.map((id) => [id]))).toEqual({
      requiredCount: 1, ownedCount: 1, missingLabels: [], hasSelection: true,
    })
    expect(matchProjectMaterials([], [], ids.map((id) => [id]))?.missingLabels).toEqual([HOUSEHOLD_MATERIAL_GROUPS.find(({ id }) => id === getMaterialGroupId(ids[0]))!.label])
  })

  it.each([
    ['彩色笔', '水溶性彩笔'],
    ['色素', '水溶性色素'],
    ['食用色素', '水溶性色素'],
    ['橡皮泥', '超轻黏土'],
    ['黏土', '风干黏土'],
    ['吹风机', '吹风机（冷风）'],
    ['塑料瓶', '塑料瓶（宽口，可放乒乓球）'],
    ['直尺', '直尺（30厘米）'],
  ])('keeps functional specifications separate: %s / %s', (ownedLabel, requiredLabel) => {
    const owned = materialCatalog.find(({ label }) => label === ownedLabel)!.id
    const required = materialCatalog.find(({ label }) => label === requiredLabel)!.id
    const sameFamily = getMaterialGroupId(owned) === getMaterialGroupId(required)
    expect(matchProjectMaterials([], [owned], [[required]])).toEqual(sameFamily ? {
      requiredCount: 1, ownedCount: 1, missingLabels: [], pendingLabels: [HOUSEHOLD_MATERIAL_GROUPS.find(({ id }) => id === getMaterialGroupId(required))!.label], hasSelection: true,
    } : {
      requiredCount: 1, ownedCount: 0, missingLabels: [HOUSEHOLD_MATERIAL_GROUPS.find(({ id }) => id === getMaterialGroupId(required))!.label], hasSelection: true,
    })
  })

  it('matches all reviewed source lists including quantity-bearing rows', () => {
    const allIds = HOUSEHOLD_MATERIALS.map(({ id }) => id)
    expect(projects.map(({ materials }) => matchProjectMaterials(materials, allIds))).toEqual(
      [3, 3, 4, 5, 5].map((count) => ({ requiredCount: count, ownedCount: count, missingLabels: [], hasSelection: true })),
    )
  })

  it('counts physical materials without treating setup conditions or optional tools as missing', () => {
    expect(matchProjectMaterials(projects[3].materials, ['balloon', 'straw', 'string', 'tape', 'scissors'])).toEqual({
      requiredCount: 5, ownedCount: 5, missingLabels: [], hasSelection: true,
    })
    expect(HOUSEHOLD_MATERIALS.some(({ id }) => id === 'anchors')).toBe(false)
  })

  it('preserves setup requirements as plain-language preparation notes in the detail', () => {
    const result = splitMaterialPreparation(projects[3].materials)
    expect(result.materials).not.toContain('两处稳固的绳端固定点')
    expect(result.materials).toContain('打气筒（建议使用）')
    expect(result.preparationNotes).toHaveLength(1)
    expect(result.preparationNotes[0]).toContain('两把稳固椅子的椅背')
    expect(splitMaterialPreparation(['未知材料', '清水'])).toEqual({ materials: ['未知材料', '清水'], preparationNotes: [] })
  })

  it('deduplicates multiple reviewed rows for the same type', () => {
    expect(matchProjectMaterials(['剪刀', '剪刀（成人使用）', '剪刀', '清水'], ['scissors', 'scissors'])).toEqual({
      requiredCount: 2, ownedCount: 1, missingLabels: ['水'], hasSelection: true,
    })
  })

  it('matches only the vetted paper and cotton-thread aliases without treating string as cotton thread', () => {
    expect(matchProjectMaterials(['A4纸1张', '白纸1张', '正方形纸1张（可由A4纸裁成）', '细棉线1根'], ['paper', 'string'])).toEqual({
      requiredCount: 2, ownedCount: 1, missingLabels: ['棉绳'], hasSelection: true,
    })
    expect(matchProjectMaterials(['细棉线1根'], ['cotton-thread'])?.missingLabels).toEqual([])
    expect(matchProjectMaterials(['弹性塑料吸管1根'], ['straw'])).toBeNull()
  })

  it('treats an unrelated valid owned type as a selection without counting it toward requirements', () => {
    expect(matchProjectMaterials(['纸杯'], ['water', 'unknown'])).toEqual({
      requiredCount: 1, ownedCount: 0, missingLabels: ['纸杯'], hasSelection: true,
    })
  })

  it('ignores invalid owned IDs and leaves the selection empty', () => {
    expect(matchProjectMaterials(['清水'], ['unknown'])).toEqual({
      requiredCount: 1, ownedCount: 0, missingLabels: ['水'], hasSelection: false,
    })
  })

  it.each([undefined, null, [], ['打气筒（建议使用）'], ['清水', '未知材料'], ['纸巾2张'], ['弯吸管1根'], ['水彩笔'], [' 清水'], ['constructor']])('leaves empty or unreviewed requirements unconfirmed: %j', (materials) => {
    expect(matchProjectMaterials(materials, HOUSEHOLD_MATERIALS.map(({ id }) => id))).toBeNull()
  })
})

describe('sortProjectsByMaterials', () => {
  it('defaults to fewest required types, preserves ties and does not mutate input', () => {
    const input = [...projects].reverse()
    const original = [...input]
    expect(sortProjectsByMaterials(input, []).map(({ id }) => id)).toEqual([103, 102, 738, 1157, 586])
    expect(input).toEqual(original)
  })

  it('sorts by missing count, then more owned types with stable ties', () => {
    const input = [
      { id: 'one-missing', materials: ['清水'] },
      { id: 'two-owned-one-missing', materials: ['纸杯', '剪刀', '清水'] },
      { id: 'ready', materials: ['纸杯'] },
      { id: 'one-owned-one-missing', materials: ['剪刀', '清水'] },
      { id: 'stable-tie', materials: ['纸杯', '清水'] },
    ]
    expect(sortProjectsByMaterials(input, ['paper-cup', 'scissors']).map(({ id }) => id)).toEqual([
      'ready', 'two-owned-one-missing', 'one-owned-one-missing', 'stable-tie', 'one-missing',
    ])
  })

  it.each([{ owned: [] }, { owned: ['water'] }])('places empty and unknown requirements last in original order with selection $owned', ({ owned }) => {
    const input = [{ id: 'empty', materials: [] }, { id: 'unknown', materials: ['未知材料'] }, { id: 'absent' }, ...projects]
    expect(sortProjectsByMaterials(input, owned).slice(-3).map(({ id }) => id)).toEqual(['empty', 'unknown', 'absent'])
  })
})

describe('explicit AND/OR household requirements', () => {
  it('counts AND items individually and alternative items only once', () => {
    const groups = [['paper'], ['tape', 'scissors']]
    expect(matchProjectMaterials(['未映射的原始完整材料'], [], groups)).toEqual({
      requiredCount: 2, ownedCount: 0, missingLabels: ['剪刀', '纸张'], hasSelection: false,
    })
    expect(matchProjectMaterials([], ['paper', 'tape'], groups)).toEqual({
      requiredCount: 2, ownedCount: 2, missingLabels: [], hasSelection: true,
    })
  })

  it('uses shared alternatives once and prefers no missing items before the fewest total types', () => {
    const groups = [['tape', 'paper'], ['tape', 'scissors']]
    expect(matchProjectMaterials([], [], groups)).toMatchObject({ requiredCount: 1, missingLabels: ['双面胶'] })
    expect(matchProjectMaterials([], ['paper', 'scissors'], groups)).toEqual({
      requiredCount: 2, ownedCount: 2, missingLabels: [], hasSelection: true,
    })
    expect(matchProjectMaterials([], ['paper', 'scissors', 'tape'], groups)).toEqual({
      requiredCount: 1, ownedCount: 1, missingLabels: [], hasSelection: true,
    })
  })

  it('breaks equal missing counts by the minimum total material set', () => {
    expect(matchProjectMaterials([], ['water'], [['water', 'tape'], ['paper', 'tape']])).toEqual({
      requiredCount: 1, ownedCount: 0, missingLabels: ['双面胶'], hasSelection: true,
    })
  })

  it('supports A or both B and C without collapsing the AND branch into one type', () => {
    const groups = [['water', 'paper'], ['water', 'scissors']]
    expect(matchProjectMaterials([], ['paper', 'scissors'], groups)).toMatchObject({ requiredCount: 2, ownedCount: 2 })
    expect(matchProjectMaterials([], ['water'], groups)).toMatchObject({ requiredCount: 1, ownedCount: 1 })
  })

  it('preserves catalog order when alternative sets tie and removes duplicate clauses', () => {
    const groups = [['paper', 'water', 'water'], ['water', 'paper']]
    expect(matchProjectMaterials([], [], groups)).toEqual({
      requiredCount: 1, ownedCount: 0, missingLabels: ['水'], hasSelection: false,
    })
  })

  it.each([[], [[]], [['water'], []], [['water', 'unknown']], [['constructor']], null, ['water']].map((requirements) => ({ requirements })))('fails closed for invalid explicit groups without legacy fallback: $requirements', ({ requirements }) => {
    expect(matchProjectMaterials(['清水'], ['water'], requirements as string[][])).toBeNull()
  })

  it('combines independent components and retains every condition', () => {
    const groups = [['paper', 'water'], ['paper', 'tape'], ['scissors'], ['milk', 'tissue'], ['milk', 'balloon']]
    expect(matchProjectMaterials([], [], groups)).toMatchObject({
      requiredCount: 3, missingLabels: ['剪刀', '牛奶', '纸张'],
    })
  })

  it('agrees with exhaustive minimum-set solutions across owned states and overlapping clauses', () => {
    const ids = HOUSEHOLD_MATERIALS.filter(({ id }) => ['water', 'paper', 'tape', 'scissors'].includes(id)).map(({ id }) => id)
    const labels = new Map(HOUSEHOLD_MATERIALS.map(({ id }) => [id, HOUSEHOLD_MATERIAL_GROUPS.find((group) => group.id === getMaterialGroupId(id))!.label]))
    const allSets = Array.from({ length: 16 }, (_, mask) => ids.filter((_, index) => mask & (1 << index)))
    for (let seed = 1; seed <= 24; seed++) {
      const groups = [seed % 15 + 1, (seed * 3) % 15 + 1, (seed * 7) % 15 + 1].map((mask) => allSets[mask])
      for (const owned of allSets) {
        const best = allSets.filter((selected) => groups.every((group) => group.some((id) => selected.includes(id))))
          .sort((left, right) => {
            const missing = left.filter((id) => !owned.includes(id)).length - right.filter((id) => !owned.includes(id)).length
            if (missing) return missing
            if (left.length !== right.length) return left.length - right.length
            for (let index = 0; index < left.length; index++) {
              const order = ids.indexOf(left[index]) - ids.indexOf(right[index])
              if (order) return order
            }
            return 0
          })[0]
        expect(matchProjectMaterials([], owned, groups)).toEqual({
          requiredCount: best.length,
          ownedCount: best.filter((id) => owned.includes(id)).length,
          missingLabels: best.filter((id) => !owned.includes(id)).map((id) => labels.get(id)),
          hasSelection: owned.length > 0,
        })
      }
    }
  })

  it('sorts cards using their explicit requirements and keeps invalid profiles last', () => {
    const cards = [
      { id: 'invalid', materials: ['清水'], householdRequirements: [[]] },
      { id: 'two-required', materials: ['未知材料'], householdRequirements: [['paper'], ['scissors']] },
      { id: 'alternative', materials: ['未知材料'], householdRequirements: [['water', 'paper']] },
    ]
    expect(sortProjectsByMaterials(cards, ['water']).map(({ id }) => id)).toEqual(['alternative', 'two-required', 'invalid'])
  })
})

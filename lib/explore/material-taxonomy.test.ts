import { describe, expect, it, vi } from 'vitest'
import catalog from './household-materials.data.json'
import { MATERIAL_FAMILIES, MATERIAL_GROUP_ALIASES, MATERIAL_SECTIONS, MATERIAL_TAXONOMY, MATERIAL_TERM_ALIASES, resolveMaterialTerm } from './material-taxonomy'
import { HOUSEHOLD_MATERIAL_GROUPS, getMaterialGroupId } from './material-groups'

const pureSynonyms = new Set(['积木块', '纸皮', '硬纸皮', '木棒', '纸板箱', '塑料刀具', '废报纸'])

describe('reviewed shared material vocabulary', () => {
  it('covers every canonical catalog row and all historical aliases without implicit guesses', () => {
    const canonical = catalog.filter((row) => !('canonicalId' in row))
    expect(MATERIAL_TAXONOMY).toHaveLength(canonical.length)
    expect(new Set(MATERIAL_TAXONOMY.map(({ id }) => id)).size).toBe(canonical.length)
    expect(new Set(MATERIAL_TAXONOMY.map(({ id }) => id))).toEqual(new Set(canonical.map(({ id }) => id)))
    for (const row of canonical) {
      const term = MATERIAL_TAXONOMY.find(({ id }) => id === row.id)!
      expect(term.sourceLabel, row.id).toBe(row.label)
      expect(resolveMaterialTerm(row.label), row.label).toBeDefined()
    }
    const aliases = catalog.filter((row) => 'canonicalId' in row)
    expect(MATERIAL_TERM_ALIASES.filter(({ id }) => id)).toHaveLength(aliases.length)
    for (const row of aliases) expect(resolveMaterialTerm(row.label), row.label).toBeDefined()
    for (const alias of MATERIAL_TERM_ALIASES) {
      const name = resolveMaterialTerm(alias.sourceLabel)!.name
      expect(HOUSEHOLD_MATERIAL_GROUPS.find(({ label }) => label === name)?.aliases, alias.sourceLabel).toContain(alias.sourceLabel)
    }
    expect(resolveMaterialTerm('未审核的新材料')).toBeUndefined()
  })

  it('places every family in one reviewed section and exposes the reviewed featured list', () => {
    expect(MATERIAL_SECTIONS).toHaveLength(9)
    const sections = new Set(MATERIAL_SECTIONS.map(({ id }) => id))
    const familyIds = new Set(MATERIAL_FAMILIES.map(({ id }) => id))
    expect(familyIds.size).toBe(MATERIAL_FAMILIES.length)
    expect(new Set(MATERIAL_FAMILIES.map(({ name }) => name)).size).toBe(MATERIAL_FAMILIES.length)
    for (const family of MATERIAL_FAMILIES) expect(sections.has(family.section), family.name).toBe(true)
    for (const term of MATERIAL_TAXONOMY) expect(familyIds.has(term.groupId), term.sourceLabel).toBe(true)
    expect(HOUSEHOLD_MATERIAL_GROUPS.filter(({ featured }) => featured)).toHaveLength(24)
    expect(HOUSEHOLD_MATERIAL_GROUPS.filter(({ common }) => common)).toHaveLength(7)
    for (const [legacy, current] of Object.entries(MATERIAL_GROUP_ALIASES)) {
      expect(familyIds.has(current), legacy).toBe(true)
      expect(getMaterialGroupId(legacy)).toBe(current)
    }
    expect(getMaterialGroupId('constructor')).toBeUndefined()
    expect(getMaterialGroupId('toString')).toBeUndefined()
  })

  it('returns stable names when already normalized material terms are processed again', () => {
    for (const { name } of MATERIAL_FAMILIES) expect(resolveMaterialTerm(name)).toEqual({ name })
    expect(resolveMaterialTerm('彩笔')).toEqual({ name: '彩笔' })
    expect(resolveMaterialTerm('硬纸皮')).toEqual({ name: '纸板', specification: '硬纸板' })
    expect(resolveMaterialTerm('木棒')).toEqual({ name: '木棍' })
  })

  it('preserves every non-synonymous historical alias qualifier, including all colors', () => {
    for (const row of catalog.filter((row) => 'canonicalId' in row)) {
      const resolved = resolveMaterialTerm(row.label)!
      if (pureSynonyms.has(row.label)) continue
      expect(resolved.specification, row.label).toBeTruthy()
      const note = row.label.match(/[（(](.*)[）)]$/)?.[1]
      if (note) expect(resolved.specification, row.label).toContain(note)
      else expect(resolved.specification, row.label).toContain(row.label)
    }
    expect(resolveMaterialTerm('彩色笔（黑红橙）')).toEqual({ name: '彩笔', specification: '黑红橙' })
    expect(resolveMaterialTerm('红色黏土')?.specification).toContain('红色')
    expect(resolveMaterialTerm('棕色碎纸')?.specification).toContain('棕色')
    expect(resolveMaterialTerm('绿色滴口瓶装水溶性色素')?.specification).toContain('绿色')
  })

  it('keeps whole requirement phrases rather than inventing truncated specifications', () => {
    expect(resolveMaterialTerm('带帽水彩笔')).toEqual({ name: '彩笔', specification: '带笔帽的水彩笔' })
    expect(resolveMaterialTerm('大白菜')?.specification).toBe('大白菜')
    expect(resolveMaterialTerm('厚卡纸板')?.specification).toBe('厚卡纸板')
    for (const water of ['清水', '热水', '冷水', '温水', '冰水']) expect(resolveMaterialTerm(water)).toEqual({ name: '水', specification: water })
    expect(resolveMaterialTerm('接水盆')?.specification).toBe('接水盆')
  })

  it('preserves the reviewed material identities for ambiguous imported terms', () => {
    expect(resolveMaterialTerm('热熔胶')).toEqual({ name: '热熔胶' })
    expect(resolveMaterialTerm('热熔胶棒')).toEqual({ name: '热熔胶', specification: '棒状' })
    expect(resolveMaterialTerm('植物')).toEqual({ name: '植物' })
    expect(resolveMaterialTerm('向日葵')).toEqual({ name: '向日葵' })
    expect(resolveMaterialTerm('色素瓶')).toEqual({ name: '瓶子', specification: '装有色素（用于配重）' })
    expect(resolveMaterialTerm('稳定小物体')?.name).toBe('桌面小物件')
    expect(resolveMaterialTerm('盛水容器（可浸入倒扣杯）')?.name).toBe('盛水容器')
    expect(resolveMaterialTerm('填充棒')).toEqual({ name: '填充工具', specification: '棒状，用于塞入填充棉' })
  })

  it('keeps unknown materials and purposes from acquiring narrower physical identities', () => {
    expect(resolveMaterialTerm('擦干用品')).toEqual({ name: '擦拭用品', specification: '擦干用' })
    expect(resolveMaterialTerm('密封盒')).toEqual({ name: '盒子', specification: '密封盒' })
    expect(resolveMaterialTerm('酸奶盒')).toEqual({ name: '盒子', specification: '酸奶盒' })
    expect(resolveMaterialTerm('透明片')).toEqual({ name: '透明片' })
    expect(resolveMaterialTerm('玻璃棒')).toEqual({ name: '玻璃棒' })
    expect(resolveMaterialTerm('搅拌用具')).toEqual({ name: '搅拌工具' })
    expect(resolveMaterialTerm('搅拌棒')).toEqual({ name: '搅拌工具', specification: '搅拌棒' })
    expect(resolveMaterialTerm('耐热托盘')).toEqual({ name: '盘子', specification: '耐热托盘' })
    expect(resolveMaterialTerm('抽屉式火柴盒（含火柴）')).toEqual({ name: '火柴盒', specification: '抽屉式，含火柴' })
    expect(resolveMaterialTerm('水溶性水彩笔')).toEqual({ name: '彩笔', specification: '水溶性彩笔' })
    expect(resolveMaterialTerm('水彩笔')).toBeUndefined()
  })

  it.each([
    ['白纸', '纸张', '白纸'], ['A4纸', '纸张', 'A4纸'], ['棉线', '棉绳', '棉线'],
    ['接水盘', '盘子', '接水用'], ['记录用纸', '纸张', '记录用'], ['纸', '纸张', undefined],
    ['透明玻璃杯', '杯子', '透明玻璃杯'], ['白乳胶', '胶水', '白乳胶'], ['冰箱冷冻室', '冰箱', '冷冻室'],
    ['皮筋', '橡皮筋', undefined], ['凉水', '水', '凉水'], ['旧报纸', '报纸', '旧报纸'],
    ['小石子', '石头', '小石子'], ['塑料瓶带盖', '瓶子', '带盖塑料瓶'], ['一元硬币', '硬币', '1元硬币'], ['玻璃珠', '珠子', '玻璃珠'],
  ])('normalizes the reviewed project phrase %s without adding a narrower specification', (source, name, specification) => {
    expect(resolveMaterialTerm(source!)).toEqual({ name, ...(specification ? { specification } : {}) })
  })

  it('leaves ambiguous ruler, glue, and salt wording unclassified', () => {
    for (const source of ['尺子', '透明胶', '盐']) expect(resolveMaterialTerm(source)).toBeUndefined()
  })

  it('rejects a missing alias family instead of guessing a material term', async () => {
    vi.resetModules()
    vi.doMock('./material-taxonomy.data.json', () => ({ default: {
      families: [], terms: [], sections: [], groupAliases: {},
      aliases: [{ sourceLabel: '未核对材料', groupId: 'group:does-not-exist' }],
    } }))
    try {
      await expect(import('./material-taxonomy')).rejects.toThrow('Invalid material alias target: 未核对材料')
    } finally {
      vi.doUnmock('./material-taxonomy.data.json')
      vi.resetModules()
    }
  })
})

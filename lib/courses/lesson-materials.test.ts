import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { summarizePackedLdrawBom, type LdrawBomEntry, type LdrawBom } from '../utils/ldraw-bom'
import {
  compareLessonMaterials,
  foldFigureComponents,
  mergeKitInventories,
  kitInventories,
  type KitInventoryPart,
  type MaterialRequirement,
} from './lesson-materials'
import { mergeLessonMaterialPreferences } from './lesson-material-preferences'
import { resolveLdrawPart } from './ldraw-part-mapping'

const prefs = mergeLessonMaterialPreferences(5)
const entry = (partId: string, colorCode = 4, count = 1): LdrawBomEntry => ({
  partId,
  colorCode,
  count,
  partName: partId,
  partDescription: '',
  colorName: 'Red',
  colorHex: '#f00',
})
const bom = (...entries: LdrawBomEntry[]): LdrawBom => ({
  entries,
  steps: [],
  stepCount: 0,
  kindCount: entries.length,
  partCount: entries.reduce((n, e) => n + e.count, 0),
})
const stock = (partNum: string, colorId = 4, quantity = 1): KitInventoryPart => ({
  partNum,
  colorId,
  quantity,
  name: partNum,
  colorName: String(colorId),
})
const req = (partId: string, count = 1): MaterialRequirement => ({
  ...entry(partId, 4, count),
  mapping: resolveLdrawPart(partId),
  status: 'satisfied',
  matched: 0,
  substituted: 0,
  missing: count,
  allocations: [],
})

it('exact fulfillment and no input mutation', () => {
  const inventory = [stock('3011')]
  expect(compareLessonMaterials(bom(entry('3011.dat')), inventory, prefs).entries[0].status).toBe(
    'satisfied',
  )
  expect(inventory[0].quantity).toBe(1)
})

it('reserves exact colors for later rows before substituting', () => {
  const result = compareLessonMaterials(
    bom(entry('3011.dat', 1), entry('3011.dat', 4)),
    [stock('3011')],
    prefs,
  )
  expect(result.entries.map((e) => e.status)).toEqual(['requiredMissing', 'satisfied'])
})

it('partial shortage retains substitutions and never double counts stock', () => {
  const result = compareLessonMaterials(bom(entry('3011.dat', 1, 3)), [stock('3011', 4, 2)], prefs)
  expect(result.stats).toMatchObject({ requiredMissing: 1, substituted: 2, matched: 2 })
  expect(result.colorSubstitutes).toHaveLength(1)
})

it('supports rejecting recoloring and unknown-color shape matching', () => {
  expect(
    compareLessonMaterials(bom(entry('3011.dat', 1)), [stock('3011')], {
      ...prefs,
      acceptColorSubstitutes: false,
    }).stats.requiredMissing,
  ).toBe(1)
  expect(
    compareLessonMaterials(bom(entry('3011.dat', 999)), [stock('3011')], prefs).entries[0].status,
  ).toBe('colorSubstitute')
})

it('optional plates become required only by explicit preference or structural whitelist', () => {
  const model = bom(entry('4268.dat'), entry('51262.dat'), entry('3811.dat'))
  expect(compareLessonMaterials(model, [], prefs).stats).toMatchObject({
    requiredMissing: 0,
    optionalMissing: 3,
  })
  expect(
    compareLessonMaterials(model, [], { ...prefs, structuralBaseplates: ['4268.dat'] }).stats
      .requiredMissing,
  ).toBe(1)
})

it('folds child figure parts into complete-figure demand', () => {
  const folded = foldFigureComponents([
    req('47205.dat', 2),
    req('47207.dat', 2),
    req('47204.dat', 2),
    req('47203p03.dat', 2),
    req('47198p03.dat', 4),
    req('47206p01.dat', 2),
    req('47199.dat', 2),
  ])
  expect(folded.figureDemand).toBe(2)
  expect(folded.folded).toHaveLength(7)
  expect(folded.remaining).toHaveLength(0)

  const result = compareLessonMaterials(
    bom(
      entry('47205.dat', 4, 2),
      entry('47198p03.dat', 4, 4),
      entry('47206p01.dat', 15, 2),
      entry('47203p03.dat', 10, 2),
      entry('47204.dat', 14, 2),
      entry('47207.dat', 0, 2),
      entry('47199.dat', 4, 2),
    ),
    [stock('47510pr0002', 212, 2)],
    prefs,
  )
  expect(result.figureDemand).toBe(2)
  expect(result.stats.unknown).toBe(0)
  expect(result.stats.requiredMissing).toBe(0)
  expect(result.unknown).toHaveLength(0)
})

it('figure shortage becomes required missing, not unknown', () => {
  const result = compareLessonMaterials(
    bom(entry('47205.dat', 4, 3), entry('47198p03.dat', 4, 6)),
    [stock('47511pr0001', 15, 1)],
    prefs,
  )
  expect(result.figureDemand).toBe(3)
  expect(result.stats.unknown).toBe(0)
  expect(result.stats.requiredMissing).toBe(2)
  expect(result.requiredMissing[0].partName).toContain('小人')
})

it('system bricks and 98223b are known; only local Toolo stays unknown', () => {
  const result = compareLessonMaterials(
    bom(entry('3001.dat', 4, 2), entry('98223b.dat'), entry('31196c01.dat')),
    [stock('31213', 4, 1)],
    prefs,
  )
  expect(result.unknown.map((e) => e.partId)).toEqual(['31196c01.dat'])
  expect(result.stats.unknown).toBe(1)
  // 98223b satisfied via 31213; 3001 required missing
  expect(result.requiredMissing.map((e) => e.partId)).toEqual(['3001.dat'])
  expect(result.stats.requiredMissing).toBe(2)
})

it('car, fence and eye aliases draw from actual inventory', () => {
  const result = compareLessonMaterials(
    bom(entry('10715p02.dat'), entry('31021p01.dat'), entry('3437pe1.dat')),
    [stock('11248c01'), stock('12602'), stock('3437pr0067')],
    prefs,
  )
  expect(result.stats).toMatchObject({ matched: 3, requiredMissing: 0, substituted: 2 })
})

it('copies merge quantities and defaults remain isolated', () => {
  const one = mergeKitInventories([{ setNum: '9090-2', copies: 1 }])
  const two = mergeKitInventories([{ setNum: '9090-2', copies: 2 }])
  expect(two.reduce((n, e) => n + e.quantity, 0)).toBe(2 * one.reduce((n, e) => n + e.quantity, 0))
  expect(mergeLessonMaterialPreferences(6).kits).toEqual([{ setNum: '45002-1', copies: 1 }])
  expect(mergeLessonMaterialPreferences(7).kits).toEqual([{ setNum: '9656-1', copies: 1 }])
  expect(mergeLessonMaterialPreferences(8).kits).toEqual([])
  expect(() => mergeLessonMaterialPreferences(5, { kits: [{ setNum: '9090-2', copies: -1 }] })).toThrow()
  for (const set of Object.values(kitInventories)) {
    expect(set.parts.reduce((n, e) => n + e.quantity, 0)).toBe(set.totalQuantity)
  }
})

it.each(['3-cheng-bao.mpd', '3-guan-dao-gou.mpd', '3-chong-wu-gou.mpd', '3-xiang-pi-ting.mpd'])(
  'real model %s',
  (filename) => {
    const model = summarizePackedLdrawBom(readFileSync(`public/courses/ldraw/${filename}`, 'utf8'))
    const result = compareLessonMaterials(model, mergeKitInventories(prefs.kits), prefs)
    expect(result.requiredMissing.map((e) => e.partId)).not.toContain('4268.dat')
    expect(result.requiredMissing.map((e) => e.partId)).not.toContain('51262.dat')
    expect(result.unknown.map((e) => e.partId)).not.toContain('47205.dat')
    expect(result.unknown.map((e) => e.partId)).not.toContain('47198p03.dat')
    expect({
      stats: result.stats,
      required: result.requiredMissing.map((e) => [e.partId, e.colorCode, e.missing]),
      unknown: result.unknown.map((e) => e.partId),
    }).toMatchSnapshot()
  },
)

it('renders parent-facing sections on the server and omits unconfigured courses', async () => {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { LessonMaterialsPreparation } = await import(
    '@/components/features/courses/lesson-materials-preparation'
  )
  const model = bom(entry('4268.dat'), entry('31196c01.dat'), entry('6510.dat'), entry('47205.dat', 4, 2))
  const html = renderToStaticMarkup(createElement(LessonMaterialsPreparation, { courseId: 5, bom: model }))
  expect(html).toContain('9090-2 × 1 套 + 9076-1 × 1 套')
  expect(html).toContain('缺件（必需）')
  expect(html).toContain('建议补齐的可选底板')
  expect(html).toContain('完整小人')
  expect(html).not.toContain('对照模型确认')
  expect(html).toContain('套装中暂无对应零件')
  expect(html).toContain('<ul')
  expect(renderToStaticMarkup(createElement(LessonMaterialsPreparation, { courseId: 8, bom: model }))).toBe(
    '',
  )
  expect(
    renderToStaticMarkup(createElement(LessonMaterialsPreparation, { courseId: 6, bom: model })),
  ).toContain('工程搭建可参考 45002')
})

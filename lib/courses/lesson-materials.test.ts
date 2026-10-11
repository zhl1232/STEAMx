import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { summarizePackedLdrawBom, type LdrawBomEntry, type LdrawBom } from '../utils/ldraw-bom'
import {
  prepareLessonBomForCourse,
  compareLessonMaterials,
  foldFigureComponents,
  mergeKitInventories,
  kitInventories,
  type KitInventoryPart,
  summarizeMaterialOutcome,
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

it('covers a structural 8×8 with two same-color 4×8 plates without mutating inputs', () => {
  const model = bom({ ...entry('51262.dat'), structural: true })
  const inventory = [stock('4672', 4, 2)]
  const original = structuredClone({ model, inventory })
  const result = compareLessonMaterials(model, inventory, { ...prefs, acceptColorSubstitutes: false })

  expect(result.stats).toMatchObject({ requiredMissing: 0, matched: 1, substituted: 1 })
  expect(result.entries[0]).toMatchObject({ status: 'colorSubstitute', missing: 0 })
  expect(result.colorSubstitutes[0].allocations).toEqual([
    { partNum: '4672', colorId: 4, colorName: '4', quantity: 2, substitute: true, areaLabel: '4×8 薄板' },
  ])
  expect({ model, inventory }).toEqual(original)
})

it.each([true, false])('covers two 8×8 with a different-color 8×16 only when recoloring is %s', (acceptColorSubstitutes) => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat', 71, 2), structural: true }),
    [stock('6490', 10)],
    { ...prefs, acceptColorSubstitutes },
  )

  expect(result.stats).toMatchObject({
    requiredMissing: acceptColorSubstitutes ? 0 : 2,
    matched: acceptColorSubstitutes ? 2 : 0,
    substituted: acceptColorSubstitutes ? 2 : 0,
  })
  expect(result.entries[0].allocations).toEqual(acceptColorSubstitutes ? [
    { partNum: '6490', colorId: 10, colorName: '10', quantity: 1, substitute: true, areaLabel: '8×16 薄板' },
  ] : [])
})

it('reserves all normally needed 8×16 plates before area substitution', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat'), structural: true }, entry('6490.dat', 1, 2)),
    [stock('6490', 4, 2)],
    prefs,
  )

  expect(result.requiredMissing).toEqual([expect.objectContaining({ partId: '51262.dat', missing: 1 })])
  expect(result.entries[0].allocations).toEqual([])
  expect(result.entries[1]).toMatchObject({ matched: 2, missing: 0 })
})

it('leaves a step-0-only 8×8 optional even when area stock is available', () => {
  const model = bom(entry('51262.dat', 71))
  model.steps = [{ stepIndex: 0, partCount: 1, entries: model.entries }]
  const result = compareLessonMaterials(
    prepareLessonBomForCourse(5, model), [stock('4672', 71, 2), stock('6490', 10)], prefs,
  )

  expect(result.optionalMissing).toEqual([expect.objectContaining({ partId: '51262.dat', missing: 1 })])
  expect(result.colorSubstitutes).toEqual([])
  expect(result.entries[0].allocations).toEqual([])
  expect(result.stats).toMatchObject({ requiredMissing: 0, matched: 0, substituted: 0 })
})

it.each([{ includeOptionalBaseplates: true }, { structuralBaseplates: ['51262.dat'] }])(
  'area-substitutes optional-shaped plates when preferences make them required: %j', (overrides) => {
    const result = compareLessonMaterials(bom(entry('51262.dat')), [stock('4672', 4, 2)], { ...prefs, ...overrides })
    expect(result.stats).toMatchObject({ requiredMissing: 0, optionalMissing: 0, substituted: 1 })
  },
)

it('keeps uncovered whole pieces required while reporting partial area substitutions', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat', 4, 2), structural: true }), [stock('4672', 4, 3)], prefs,
  )

  expect(result.stats).toMatchObject({ requiredMissing: 1, matched: 1, substituted: 1 })
  expect(result.requiredMissing[0]).toBe(result.colorSubstitutes[0])
  expect(result.entries[0].allocations[0]).toMatchObject({ partNum: '4672', quantity: 3, substitute: true })
})

it('combines area across colors and plate sizes, preferring 4×8 within a color pass', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat', 4, 3), structural: true }),
    [stock('6490', 4), stock('4672', 4), stock('4672', 1)],
    prefs,
  )

  expect(result.stats).toMatchObject({ requiredMissing: 0, matched: 3, substituted: 3 })
  expect(result.entries[0].allocations.map((a) => [a.partNum, a.colorId, a.quantity])).toEqual([
    ['4672', 4, 1], ['6490', 4, 1], ['4672', 1, 1],
  ])
})

it('reserves same-color area stock for later rows before using other colors', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat', 1), structural: true }, { ...entry('51262.dat', 4), structural: true }),
    [stock('4672', 4, 2)], prefs,
  )
  expect(result.entries.map((row) => row.status)).toEqual(['requiredMissing', 'colorSubstitute'])
})

it('takes a whole 8×16 for one 8×8 and never reuses its wasted area', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat', 4), structural: true }, { ...entry('51262.dat', 1), structural: true }),
    [stock('6490')], prefs,
  )
  expect(result.entries.map((row) => row.missing)).toEqual([0, 1])
  expect(result.entries[0].allocations[0]).toMatchObject({ partNum: '6490', quantity: 1 })
})

it('does not use 2×8 plates or count a single 4×8 as a complete 8×8', () => {
  const result = compareLessonMaterials(
    bom({ ...entry('51262.dat'), structural: true }), [stock('44524', 4, 10), stock('4672')], prefs,
  )
  expect(result.stats).toMatchObject({ requiredMissing: 1, matched: 0, substituted: 0 })
  expect(result.colorSubstitutes).toEqual([])
  expect(result.entries[0].allocations.map((a) => a.partNum)).toEqual(['4672'])
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

it('stacks any combination of kit copies', () => {
  const model = bom(entry('3011.dat', 4, 30))
  const run = (kits: { setNum: string; copies: number }[]) =>
    compareLessonMaterials(model, mergeKitInventories(kits), mergeLessonMaterialPreferences(5, { kits }))
  // 9090-2 共 140 块 2×4（红 20），9076-1 共 20 块（红 4）；默认允许换色
  expect(run([{ setNum: '9090-2', copies: 1 }]).stats.requiredMissing).toBe(0)
  expect(run([{ setNum: '9076-1', copies: 1 }]).stats.requiredMissing).toBe(10)
  expect(run([{ setNum: '9076-1', copies: 2 }]).stats.requiredMissing).toBe(0)
  expect(run([]).stats.requiredMissing).toBe(30)
  const exactOnly = (kits: { setNum: string; copies: number }[]) =>
    compareLessonMaterials(model, mergeKitInventories(kits), { ...mergeLessonMaterialPreferences(5, { kits }), acceptColorSubstitutes: false }).stats.requiredMissing
  expect(exactOnly([{ setNum: '9090-2', copies: 1 }])).toBe(10)
  expect(exactOnly([{ setNum: '9090-2', copies: 1 }, { setNum: '9076-1', copies: 2 }])).toBe(2)
  expect(exactOnly([{ setNum: '9090-2', copies: 2 }])).toBe(0)
  // 9656-1 有 4 块红 2×4：0 套 9090 + 3 套 9656 → 30 - 12
  expect(exactOnly([{ setNum: '9090-2', copies: 0 }, { setNum: '9656-1', copies: 3 }])).toBe(18)
})

it('summarizes outcome for the headline', () => {
  const short = compareLessonMaterials(bom(entry('3011.dat', 4, 3), entry('4196.dat', 4, 2)), [stock('3011', 4, 1)], prefs)
  expect(summarizeMaterialOutcome(short)).toEqual({ status: 'short', missingKinds: 2, missingPieces: 4, specialPieces: 0 })
  const ok = compareLessonMaterials(bom(entry('3011.dat'), entry('31196c01.dat')), [stock('3011')], prefs)
  expect(summarizeMaterialOutcome(ok)).toEqual({ status: 'complete', missingKinds: 0, missingPieces: 0, specialPieces: 1 })
})

it('figure folding never appears in the colour-substitute list', () => {
  const result = compareLessonMaterials(bom(entry('47205.dat', 4, 1)), [stock('47510pr0002', 212, 1)], prefs)
  expect(result.colorSubstitutes).toHaveLength(0)
  expect(result.stats.requiredMissing).toBe(0)
})

it.each([5, 6, 7])('prepares Duplo course %s without mutation and is idempotent', (courseId) => {
  const model = bom(
    entry('parts/3001.DAT', 4, 2),
    entry('3003.dat'),
    entry('3020.dat'),
    entry('41539.dat'),
    entry('3811.dat'),
    entry('3011.dat', 4, 3),
    entry('3001.dat', 1),
    entry('4196.dat'),
  )
  model.steps = [{ stepIndex: 1, partCount: model.partCount, entries: model.entries }]
  model.stepCount = 1
  const original = structuredClone(model)
  const prepared = prepareLessonBomForCourse(courseId, model)
  expect(prepared.entries).toEqual([
    { ...entry('3011.dat', 4, 5), partName: '2×4 积木', partDescription: 'Duplo Brick 2 x 4' },
    { ...entry('3437.dat'), partName: '2×2 积木', partDescription: 'Duplo Brick 2 x 2' },
    { ...entry('40666.dat'), partName: '2×4 薄板', partDescription: 'Duplo Plate 2 x 4' },
    { ...entry('51262.dat'), partName: '8×8 薄板', partDescription: 'Duplo Plate 8 x 8', structural: true },
    { ...entry('4268.dat'), partName: '24×24 底板', partDescription: 'Duplo Baseplate 24 x 24' },
    { ...entry('3011.dat', 1), partName: '2×4 积木', partDescription: 'Duplo Brick 2 x 4' },
    entry('4196.dat'),
  ])
  expect(prepared.kindCount).toBe(7)
  expect(prepared.partCount).toBe(model.partCount)
  expect(prepared.stepCount).toBe(1)
  expect(prepared.steps).toEqual([{ stepIndex: 1, partCount: model.partCount, entries: prepared.entries }])
  expect(model).toEqual(original)
  expect(prepareLessonBomForCourse(courseId, prepared)).toEqual(prepared)
})

it('leaves courses without kit comparison unchanged', () => {
  const model = bom(entry('3001.dat'), entry('51262.dat'))
  model.steps = [{ stepIndex: 2, partCount: model.partCount, entries: model.entries }]
  model.stepCount = 1
  expect(prepareLessonBomForCourse(1, model)).toBe(model)
})

it.each([0, 2])('classifies 8×8 plates by stepIndex %s and leaves later 24×24 bases optional', (stepIndex) => {
  const plate = entry('51262.dat', 71, 2)
  const base = entry('4268.dat', 2)
  const model = bom(plate, base)
  model.steps = [
    { stepIndex, partCount: plate.count, entries: [plate] },
    { stepIndex: 3, partCount: base.count, entries: [base] },
  ]
  model.stepCount = model.steps.length
  const original = structuredClone(model)

  const prepared = prepareLessonBomForCourse(5, model)
  const result = compareLessonMaterials(prepared, [], prefs)

  expect(prepared.entries.find((row) => row.partId === plate.partId)?.structural).toBe(
    stepIndex > 0 ? true : undefined,
  )
  expect(prepared.steps[0].entries[0].structural).toBe(stepIndex > 0 ? true : undefined)
  expect(prepared.entries.find((row) => row.partId === base.partId)?.structural).toBeUndefined()
  expect(prepared.steps[1].entries[0].structural).toBeUndefined()
  expect(result.requiredMissing).toEqual(stepIndex > 0 ? [expect.objectContaining({
    partId: plate.partId, colorCode: 71, count: 2, missing: 2, structural: true,
  })] : [])
  expect(result.optionalMissing.map((row) => row.partId)).toEqual(
    stepIndex > 0 ? [base.partId] : [plate.partId, base.partId],
  )
  expect(summarizeMaterialOutcome(result).missingPieces).toBe(stepIndex > 0 ? 2 : 0)
  expect(model).toEqual(original)
  expect(prepareLessonBomForCourse(5, prepared)).toEqual(prepared)
})

it('marks every matching plate row after rewriting, without marking other colors or 24×24 bases', () => {
  const model = bom(
    entry('41539.dat', 71), entry('parts/51262.DAT', 71), entry('51262.dat', 2),
    entry('3811.dat', 2),
  )
  model.steps = [
    { stepIndex: 0, partCount: 2, entries: [entry('parts/51262.DAT', 71), entry('51262.dat', 2)] },
    { stepIndex: 2, partCount: 2, entries: [entry('41539.dat', 71), entry('3811.dat', 2)] },
  ]
  model.stepCount = 2
  const original = structuredClone(model)

  const prepared = prepareLessonBomForCourse(5, model)

  expect(prepared.kindCount).toBe(3)
  expect(prepared.entries[0]).toMatchObject({ partId: '51262.dat', colorCode: 71, count: 2, structural: true })
  expect(prepared.steps[0].entries[0].structural).toBe(true)
  expect(prepared.steps[1].entries[0].structural).toBe(true)
  for (const row of [...prepared.entries.slice(1), prepared.steps[0].entries[1], prepared.steps[1].entries[1]]) {
    expect(row.structural).toBeUndefined()
  }
  expect(model).toEqual(original)
  expect(prepareLessonBomForCourse(5, prepared)).toEqual(prepared)
})

it('preserves structural flags when merging normalized part ids', () => {
  const model = bom(entry('parts/3011.DAT'), { ...entry('3011.dat'), structural: true })
  const original = structuredClone(model)
  const prepared = prepareLessonBomForCourse(5, model)
  expect(prepared.entries).toEqual([{ ...entry('parts/3011.DAT', 4, 2), structural: true }])
  expect(prepared.kindCount).toBe(1)
  expect(model).toEqual(original)
  expect(prepareLessonBomForCourse(5, prepared)).toEqual(prepared)
})

it('covers the real Eiffel Tower with default small-class Duplo kits', () => {
  const model = summarizePackedLdrawBom(
    readFileSync('public/courses/ldraw/3-ai-fei-er-tie-ta.mpd', 'utf8'),
  )
  const prepared = prepareLessonBomForCourse(5, model)
  const standIns = ['3001.dat', '3003.dat', '3020.dat', '41539.dat', '3811.dat']
  for (const row of [...prepared.entries, ...prepared.steps.flatMap((step) => step.entries)]) {
    expect(standIns).not.toContain(row.partId)
  }
  const result = compareLessonMaterials(prepared, mergeKitInventories(prefs.kits), prefs)
  expect(prepared.partCount).toBe(74)
  expect(result.requiredMissing).toEqual([])
  expect(result.colorSubstitutes).toContainEqual(expect.objectContaining({
    partId: '51262.dat', colorCode: 71, count: 2, missing: 0, substituted: 2, structural: true,
    allocations: [
      expect.objectContaining({ partNum: '4672', quantity: 2, areaLabel: '4×8 薄板' }),
      expect.objectContaining({ partNum: '6490', quantity: 1, areaLabel: '8×16 薄板' }),
    ],
  }))
  for (const row of result.entries) expect(standIns).not.toContain(row.partId)
  expect(result.stats.matched).toBeGreaterThanOrEqual(70)
  expect(summarizeMaterialOutcome(result)).toMatchObject({ status: 'complete', missingPieces: 0 })
})

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { summarizePackedLdrawBom, type LdrawBomEntry, type LdrawBom } from '../utils/ldraw-bom'
import {
  substituteDetail,
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

it('material accounting never mutates the model BOM or its prepared copy', () => {
  const original = summarizePackedLdrawBom(readFileSync('public/courses/ldraw/3-hu-die.mpd', 'utf8'))
  const snapshot = structuredClone(original)
  const prepared = prepareLessonBomForCourse(5, original)
  const preparedSnapshot = structuredClone(prepared)
  compareLessonMaterials(original, mergeKitInventories(prefs.kits), prefs)
  compareLessonMaterials(prepared, mergeKitInventories(prefs.kits), prefs)
  expect(original).toStrictEqual(snapshot)
  expect(prepared).toStrictEqual(preparedSnapshot)
})
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

it('known cockpit is missing, not unknown, without its kit', () => {
  const result = compareLessonMaterials(
    bom(entry('3001.dat', 4, 2), entry('98223b.dat'), entry('31196c01.dat')),
    [stock('31213', 4, 1)],
    prefs,
  )
  expect(result.unknown).toEqual([])
  expect(result.stats.unknown).toBe(0)
  // 98223b satisfied via 31213; brick and cockpit require inventory
  expect(result.requiredMissing.map((e) => e.partId)).toEqual(['3001.dat', '31196c01.dat'])
  expect(result.stats.requiredMissing).toBe(3)
})

it('car, fence and eye aliases draw from actual inventory', () => {
  const result = compareLessonMaterials(
    bom(entry('10715p02.dat'), entry('31021p01.dat'), entry('3437pe1.dat')),
    [stock('11248c01'), stock('12602'), stock('3437pr0067')],
    prefs,
  )
  expect(result.stats).toMatchObject({ matched: 3, requiredMissing: 0, substituted: 1 })
})

it('copies merge quantities and defaults remain isolated', () => {
  const one = mergeKitInventories([{ setNum: '9090-2', copies: 1 }])
  const two = mergeKitInventories([{ setNum: '9090-2', copies: 2 }])
  expect(two.reduce((n, e) => n + e.quantity, 0)).toBe(2 * one.reduce((n, e) => n + e.quantity, 0))
  expect(mergeLessonMaterialPreferences(6).kits).toEqual([{ setNum: '9090-2', copies: 1 }, { setNum: '9076-1', copies: 1 }, { setNum: '45002-1', copies: 1 }])
  expect(mergeLessonMaterialPreferences(7).kits).toEqual([{ setNum: '9090-2', copies: 1 }, { setNum: '9076-1', copies: 1 }, { setNum: '9656-1', copies: 1 }])
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
  const ok = compareLessonMaterials(bom(entry('3011.dat'), entry('unreviewed-xyz.dat')), [stock('3011')], prefs)
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


it('real middle-class excavator has no unknown parts with default kits', () => {
  const model = summarizePackedLdrawBom(readFileSync('public/courses/ldraw/4-wa-tu-ji.mpd', 'utf8'))
  const defaults = mergeLessonMaterialPreferences(6)
  const result = compareLessonMaterials(prepareLessonBomForCourse(6, model), mergeKitInventories(defaults.kits), defaults)
  expect(model.partCount).toBeGreaterThan(0)
  expect(result.unknown).toEqual([])
})

it.each(['10111c01pr0005', '47202pr9999', '75115pr0006', '75115pr0012', '75121pr0008', '47511pr0006'])(
  'folded figure demand consumes complete figure %s', (partNum) => {
    const result = compareLessonMaterials(bom(entry('63710.dat')), [stock(partNum)], prefs)
    expect(result.figureDemand).toBe(1)
    expect(result.stats.requiredMissing).toBe(0)
    expect(result.entries.find((row) => row.partName === '完整小人（含成人）')?.allocations).toEqual([
      expect.objectContaining({ partNum, quantity: 1 }),
    ])
  },
)

it.each([6, 7])('course %s applies structural stand-in and area substitution rules', (courseId) => {
  const model = bom(entry('41539.dat', 71))
  model.steps = [{ stepIndex: 1, partCount: 1, entries: model.entries }]
  const prepared = prepareLessonBomForCourse(courseId, model)
  const defaults = mergeLessonMaterialPreferences(courseId)
  expect(prepared.entries[0]).toMatchObject({ partId: '51262.dat', structural: true })
  for (const inventory of [[stock('4672', 71, 2)], [stock('6490', 71)]]) {
    const result = compareLessonMaterials(prepared, inventory, defaults)
    expect(result.requiredMissing).toEqual([])
    expect(result.colorSubstitutes).toHaveLength(1)
  }
})


it('keeps course 5 step positions and empty steps while converting stand-in names', () => {
  const model = bom(entry('3001.dat', 4, 2), entry('3003.dat'))
  model.steps = [
    { stepIndex: 0, partCount: 2, entries: [entry('3001.dat', 4, 2)] },
    { stepIndex: 1, partCount: 0, entries: [] },
    { stepIndex: 2, partCount: 1, entries: [entry('3003.dat')] },
  ]
  model.stepCount = 3
  const prepared = prepareLessonBomForCourse(5, model)
  expect(prepared.steps.map((step) => step.stepIndex)).toEqual([0, 1, 2])
  expect(prepared.steps.map((step) => step.partCount)).toEqual([2, 0, 1])
  expect(prepared.steps[0].entries[0]).toMatchObject({ partId: '3011.dat', partName: '2×4 积木', count: 2 })
  expect(prepared.steps[1].entries).toEqual([])
  expect(prepared.steps[2].entries[0]).toMatchObject({ partId: '3437.dat', partName: '2×2 积木' })
  expect(prepared.stepCount).toBe(3)
})


it.each([[7, 71, '浅灰色', 'Light Bluish Gray'], [8, 72, '深灰色', 'Dark Bluish Gray'], [6, 70, '棕色', 'Reddish Brown'], [19, 19, '米色', 'Tan']])(
  'treats displayed color family %s / %s as exact even with substitutions disabled',
  (modelColor, kitColor, colorName, kitName) => {
    const result = compareLessonMaterials(bom({ ...entry('3011.dat', modelColor), colorName }),
      [{ ...stock('3011', kitColor), colorName: kitName }], { ...prefs, acceptColorSubstitutes: false })
    expect(result.entries[0]).toMatchObject({ status: 'satisfied', substituted: 0, missing: 0 })
  },
)

it('kit colors follow the majority allocation and retain the model color with no stock', () => {
  const model = bom({ ...entry('28331.dat', 7, 4), colorName: '浅灰色' })
  const result = compareLessonMaterials(model, [
    { ...stock('74844', 71, 1), colorName: 'Light Bluish Gray' },
    { ...stock('74844', 72, 3), colorName: 'Dark Bluish Gray' },
  ], { ...prefs, acceptColorSubstitutes: false })
  expect(result.entries[0]).toMatchObject({ colorName: '深灰色', colorCode: 72, substituted: 0, missing: 0 })
  expect(result.colorSubstitutes).toEqual([])
  expect(compareLessonMaterials(model, [], prefs).entries[0].colorName).toBe('浅灰色')
  expect(model.entries[0].colorCode).toBe(7)
})

it('describes a printed door replaced by a plain door in the same color', () => {
  const result = compareLessonMaterials(bom({ ...entry('90265p01.dat', 15), colorName: '白色', partName: '1×4×4 门' }),
    [{ ...stock('90265', 15), colorName: 'White' }], prefs)
  expect(substituteDetail(result.entries[0])).toBe('可用无图案的白色1×4×4 门 1 块')
})

it.each([
  { partDifference: '不同图案的', expected: '可用不同图案的黄色2×2 积木（花朵） 3 块、可以用 红色 1 块' },
  { expected: '可以用 黄色 3 块、可以用 红色 1 块' },
  { areaLabel: '4×8 薄板', expected: '用 3 块黄色 4×8 薄板、1 块红色同款零件代替' },
])('merges matching substitute phrases and sums quantities: $expected', ({ partDifference, areaLabel, expected }) => {
  const allocation = {
    partNum: '3437pr9998', colorId: 14, colorName: 'Yellow', quantity: 2,
    substitute: true, partDifference, areaLabel,
  }
  const row = {
    ...req('3437.dat', 4),
    partName: '2×2 积木（花朵）',
    allocations: [
      allocation,
      { partNum: '3437', colorId: 4, colorName: 'Red', quantity: 1, substitute: true },
      { ...allocation, partNum: '3437pr9999', colorName: '黄色', quantity: 1 },
      { ...allocation, quantity: 5, substitute: false },
    ],
  }
  expect(substituteDetail(row)).toBe(expected)
  expect(row.allocations.map((a) => a.quantity)).toEqual([2, 1, 1, 5])
})

it('same part and mold-only variants are ordinary matches despite flexibility', () => {
  for (const partId of ['90265b.dat', '90265.dat']) {
    const result = compareLessonMaterials(bom(entry(partId, 15)), [stock('90265', 15)], prefs,
      partId === '90265.dat' ? () => ({ partNums: ['90265'], flags: { printedFlexible: true, colorFlexible: true } }) : undefined)
    expect(result.entries[0].status).toBe('satisfied')
    expect(substituteDetail(result.entries[0])).toBe('')
  }
})


it('equivalent plain door aliases do not invent a difference from catalog wording', () => {
  const result = compareLessonMaterials(bom({ ...entry('89849.dat', 15), colorName: '白色', partName: '1×4×4 门' }),
    [{ ...stock('90265', 15), colorName: 'White', name: 'Duplo Door / Window with Four Equal Square Cornered Panes' }], prefs)
  expect(result.colorSubstitutes).toEqual([])
})

it.each([
  ['3437pe0.dat', '3437pr0067', 4, 4, 'Red', 'Red'],
  ['3437pe2.dat', '3437pr0049', 14, 14, 'Yellow', 'Yellow'],
  ['3437pr0067.dat', '3437pr0049', 7, 71, 'Light Gray', 'Light Bluish Gray'],
  ['3437pr0049.dat', '3437pr0067', 6, 70, 'Brown', 'Reddish Brown'],
  ['3437p01.dat', '3437pr9999', 15, 15, 'White', 'White'],
])('same-display-color eyes are normal matches: %s → %s', (id, partNum, colorCode, colorId, colorName, stockColor) => {
  const result = compareLessonMaterials(bom({
    ...entry(id, colorCode, 2), colorName, partName: '2×2 积木（眼睛）',
    partDescription: 'Duplo Brick 2 x 2 with Eye Pattern',
  }), [{ ...stock(partNum, colorId, 2), colorName: stockColor, name: 'Duplo Brick 2 x 2 with Eyes Print' }],
  { ...prefs, acceptColorSubstitutes: false })
  expect(result.entries[0]).toMatchObject({ status: 'satisfied', matched: 2, substituted: 0, missing: 0 })
  expect(result.entries[0].allocations).toEqual([expect.objectContaining({ substitute: false })])
  expect(substituteDetail(result.entries[0])).toBe('')
  expect(result.colorSubstitutes).toEqual([])
  expect(result.stats.substituted).toBe(0)
})

it('uses eye stock before plain stock and counts only the plain remainder as a substitute', () => {
  const model = bom({ ...entry('3437pe1.dat', 4, 3), partName: '2×2 积木（眼睛）' })
  const inventory = [
    { ...stock('3437', 4, 3), colorName: 'Red', name: 'Duplo Brick 2 x 2' },
    { ...stock('3437pr9999', 4, 1), colorName: 'Red', name: 'Duplo Brick 2 x 2 with Eye Print' },
    { ...stock('3437pr0067', 4, 1), colorName: 'Red' },
  ]
  const result = compareLessonMaterials(model, inventory, prefs)
  expect(result.entries[0]).toMatchObject({ matched: 3, substituted: 1, missing: 0 })
  expect(result.entries[0].allocations.map((a) => [a.partNum, a.quantity, a.substitute])).toEqual([
    ['3437pr9999', 1, false], ['3437pr0067', 1, false], ['3437', 1, true],
  ])
  expect(substituteDetail(result.entries[0])).toBe('可用无图案的红色2×2 积木 1 块')
  expect(inventory.map((part) => part.quantity)).toEqual([3, 1, 1])
})

it.each([
  ['3437', 4, 'Red', 'Duplo Brick 2 x 2', '可用无图案的红色2×2 积木 1 块'],
  ['3437', 14, 'Yellow', 'Duplo Brick 2 x 2', '可用无图案的黄色2×2 积木 1 块'],
  ['3437pr0067', 14, 'Yellow', 'Duplo Brick 2 x 2 with Eye Print', '可以用 黄色 1 块'],
])('plain or differently colored eyes keep substitute wording: %s, %s', (partNum, colorId, colorName, name, detail) => {
  const result = compareLessonMaterials(bom({ ...entry('3437pe1.dat'), partName: '2×2 积木（眼睛）' }),
    [{ ...stock(partNum, colorId), colorName, name }], prefs)
  expect(result.entries[0]).toMatchObject({ status: 'colorSubstitute', matched: 1, substituted: 1, missing: 0 })
  expect(result.colorSubstitutes).toHaveLength(1)
  expect(substituteDetail(result.entries[0])).toBe(detail)
})

it('does not use other prints or other eye shapes as equivalent eye stock', () => {
  const result = compareLessonMaterials(bom(entry('3437pe1.dat')), [
    { ...stock('3437pr9999'), name: 'Duplo Brick 2 x 2 with Flower Print' },
    { ...stock('4198pr0001'), name: 'Duplo Brick with Eyes Print' },
  ], prefs)
  expect(result.stats).toMatchObject({ requiredMissing: 1, matched: 0, substituted: 0 })
})

it('describes two differently colored equivalent eyes using only color and quantity', () => {
  const result = compareLessonMaterials(bom(entry('3437pe1.dat', 4, 2)), [
    { ...stock('3437pr0067', 10, 2), colorName: 'Bright Green', name: 'Duplo Brick 2 x 2 with Eye Print' },
  ], prefs)
  const row = result.entries[0]
  expect(substituteDetail(row)).toBe('可以用 亮绿色 2 块')
  // Older allocation payloads may still carry a print difference.
  expect(substituteDetail({ ...row, allocations: row.allocations.map((a) => ({
    ...a, partDifference: '不同图案的',
  })) })).toBe('可以用 亮绿色 2 块')
})

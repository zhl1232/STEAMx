import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { packLocalLdrawModel } from './ldraw-packer'
import { summarizePackedLdrawBom, type LdrawBomEntry } from '../utils/ldraw-bom'
import { buildEmbeddedLookup, createPackedLdrawStep, splitPackedMpd } from '../utils/ldraw-mpd'
import { compareLessonMaterials, mergeKitInventories, prepareLessonBomForCourse } from './lesson-materials'
import { getDefaultKitsForCourse } from './course-kit-config'
import { resolveLdrawPart } from './ldraw-part-mapping'
import inventories from './ldraw-kit-inventories.json'
import { mergeLessonMaterialPreferences } from './lesson-material-preferences'

// Source integration regression: exercise the real local packer and the same
// step/material APIs used by the lesson pages, without database or network IO.
const models = [
  ['5-lan-che', 1, 17],
  ['5-ma-tou-diao-ji', 1, 14],
  ['5-sheng-jiang-dian-ti', 2, 13],
  ['5-chou-you-ji', 1, 12],
  ['5-diao-che', 1, 17],
  ['5-re-qi-qiu', 4, 12],
  ['5-shui-jing', 2, 13],
  ['5-shui-zha', 2, 14],
  ['5-ta-diao', 1, 15],
  ['5-ti-xian-mu-ou', 2, 9],
  ['5-tian-ping', 4, 10],
  ['4-long-men-diao', 0, 12],
  ['5-long-men-diao', 1, 14],
] as const

function expectNoSchematics(entries: LdrawBomEntry[]) {
  expect(entries.map((entry) => entry.partId)).not.toContain('steamx-rope.dat')
  expect(entries.map((entry) => entry.partId)).not.toContain('steamx-75536-hook.dat')
  expect(entries.map((entry) => entry.partId)).not.toContain('steamx-14013c01-hook.dat')
}

it.each(models)('%s packs ropes without adding schematic materials', async (slug, count, steps) => {
  const packed = await packLocalLdrawModel(`${slug}.ldr`)
  expect(packed.missingParts).toEqual([])
  expect(packed.stepCount).toBe(steps)
  const { mainText, embedded } = splitPackedMpd(packed.mpdText)
  const lookup = buildEmbeddedLookup(embedded)
  expect(lookup.get('s/steamx-rope.dat')).toContain('!LDRAW_ORG Unofficial_Subpart')
  expect(embedded.has('parts/s/steamx-rope.dat')).toBe(true)
  expect(mainText).not.toMatch(/^2\s/m)

  const bom = summarizePackedLdrawBom(packed.mpdText)
  const assemblies = (entries: LdrawBomEntry[]) => entries
    .filter((entry) => entry.partId === '75536.dat').reduce((sum, entry) => sum + entry.count, 0)
  expect(assemblies(bom.entries)).toBe(count)
  expect(bom.steps.reduce((sum, step) => sum + assemblies(step.entries), 0)).toBe(count)
  expectNoSchematics(bom.entries)
  expect(bom.entries.filter((entry) => entry.partId === '4663.dat').reduce((sum, entry) => sum + entry.count, 0))
    .toBe(0)

  for (const step of bom.steps) {
    expectNoSchematics(step.entries)
    // This is the API's actual recursive dependency packing, including empty
    // preparation steps and the s/ -> parts/s/ Loader key convention.
    const isolated = createPackedLdrawStep(packed.mpdText, step.stepIndex)
    expect(isolated.stepCount).toBe(steps)
    const isolatedBom = summarizePackedLdrawBom(isolated.mpdText)
    expect(isolatedBom.entries).toEqual(step.entries)
    expectNoSchematics(isolatedBom.entries)
  }

  const ropeLines = mainText.split('\n').filter((line) => /^1 .* s\/steamx-rope.dat$/.test(line))
  const hookEyes = mainText.split('\n')
    .filter((line) => /^1 .* s\/steamx-(?:75536|14013c01)-hook\.dat$/.test(line))
    .map((line) => line.split(/\s+/).slice(2, 5).map(Number))
  expect(ropeLines).toHaveLength(slug === '4-long-men-diao' ? 2 : count)
  expect(hookEyes).toHaveLength(count || 1)
  const connectedHooks = new Set<number>()
  for (const line of ropeLines) {
    const tokens = line.split(/\s+/)
    expect(tokens[1]).toBe('0')
    const m = tokens.slice(5, 14).map(Number)
    const x = [m[0], m[3], m[6]], y = [m[1], m[4], m[7]], z = [m[2], m[5], m[8]]
    expect(Math.hypot(...x)).toBeCloseTo(3, 5)
    expect(Math.hypot(...z)).toBeCloseTo(3, 5)
    expect(Math.hypot(...y)).toBeGreaterThan(0)
    expect(x.reduce((sum, value, i) => sum + value * z[i], 0)).toBeCloseTo(0, 4)
    const length = Math.hypot(...y)
    expect(x.reduce((sum, value, i) => sum + value * y[i] / length, 0)).toBeCloseTo(0, 5)
    expect(z.reduce((sum, value, i) => sum + value * y[i] / length, 0)).toBeCloseTo(0, 5)
    const start = tokens.slice(2, 5).map(Number)
    const end = start.map((value, i) => value + y[i])
    const hook = hookEyes.findIndex((eye) => Math.hypot(...eye.map((value, i) => value - end[i])) < 0.00001)
    if (hook >= 0) {
      connectedHooks.add(hook)
    } else {
      // The winch lead clears the bracket before joining the vertical cord.
      const next = ropeLines.findIndex((candidate, i) => i > ropeLines.indexOf(line) &&
        candidate.split(/\s+/).slice(2, 5).map(Number).every((value, axis) => Math.abs(value - end[axis]) < 0.00001))
      expect(next, 'every cord segment must lead to a later segment or a hook eye').toBeGreaterThanOrEqual(0)
    }
  }
  expect(connectedHooks.size).toBe(hookEyes.length)
}, 60_000)

it.each([
  ['5-re-qi-qiu', 1, 4, 2, 2],
  ['5-re-qi-qiu', 2, 4, 4, 0],
  ['5-tian-ping', 1, 4, 2, 2],
  ['5-tian-ping', 2, 4, 4, 0],
  ['5-lan-che', 1, 1, 1, 0],
] as const)('%s with 9656 ×%s accounts for complete 75536 assemblies', async (slug, copies, needs, matched, missing) => {
  const packed = await packLocalLdrawModel(`${slug}.ldr`)
  const bom = prepareLessonBomForCourse(7, summarizePackedLdrawBom(packed.mpdText))
  const kits = [{ setNum: '9656-1', copies }]
  const prefs = { ...mergeLessonMaterialPreferences(7), kits }
  const result = compareLessonMaterials(bom, mergeKitInventories(kits), prefs)
  expect(result.entries.find((entry) => entry.partId === '75536.dat')).toMatchObject({
    count: needs, matched, missing,
    status: missing ? 'requiredMissing' : 'satisfied',
  })
}, 60_000)

it('defines the local composite using only official wheel geometry', () => {
  const composite = readFileSync('scripts/ldraw-models/parts/75536.dat', 'utf8')
  expect(composite).toContain('!LDRAW_ORG Unofficial_Part')
  expect(composite.split('\n').filter((line) => line.startsWith('1 '))).toEqual([
    '1 16 0 0 0 1 0 0 0 1 0 0 0 1 6527.dat',
  ])
})

it('中班龙门吊 counts one complete winch and one bracket, covered by course 6 defaults', async () => {
  const packed = await packLocalLdrawModel('4-long-men-diao.ldr')
  const rawBom = summarizePackedLdrawBom(packed.mpdText)
  const bom = prepareLessonBomForCourse(6, rawBom)
  for (const candidate of [rawBom, bom]) {
    for (const entries of [candidate.entries, candidate.steps.flatMap((step) => step.entries)]) {
      for (const [id, color] of [['14013c01', 71], ['13358', 0]] as const) {
        expect(entries.filter((entry) => entry.partId === `${id}.dat`)).toMatchObject([
          { count: 1, colorCode: color },
        ])
        expect(resolveLdrawPart(`${id}.dat`)).toEqual({ partNums: [id], flags: {} })
        expect(inventories['45002-1'].parts.filter((part) => part.partNum === id)).toMatchObject([
          { quantity: 1, colorId: color },
        ])
      }
      for (const id of ['75536.dat', '6527.dat', '4663.dat']) {
        expect(entries.map((entry) => entry.partId)).not.toContain(id)
      }
      expectNoSchematics(entries)
    }
  }
  const kits = getDefaultKitsForCourse(6)
  const result = compareLessonMaterials(bom, mergeKitInventories(kits), mergeLessonMaterialPreferences(6))
  // The existing 13 Toolo base blocks exceed the default kit's 7; this repair
  // must introduce no shortage for either of the two replacement materials.
  expect(result.requiredMissing.filter((entry) => ['14013c01.dat', '13358.dat'].includes(entry.partId))).toEqual([])
  for (const id of ['14013c01.dat', '13358.dat']) {
    expect(result.entries.find((entry) => entry.partId === id)).toMatchObject({
      count: 1, matched: 1, missing: 0, status: 'satisfied',
    })
  }
}, 60_000)

import { expect, it } from 'vitest'
import { resolveLdrawPart, VIRTUAL_CHILD_FIGURE } from './ldraw-part-mapping'

it.each([
  ['10715.dat', ['11248c01', '11248c02']],
  ['10715p01.dat', ['11248c02']],
  ['10715p02.dat', ['11248c01']],
  ['14639p02.dat', ['11248c01']],
  ['31021.dat', ['12602']],
  ['31021p01.dat', ['12602']],
  ['3437pe1.dat', ['3437pr0049', '3437pr0067', '3437']],
  ['2301b.dat', ['2301']],
  ['2302b.dat', ['2302']],
  ['98223b.dat', ['31213', '98223']],
  ['22119.dat', ['41250']],
  ['73162p01.dat', ['4198']],
  ['89849.dat', ['90265', '89849']],
  ['2205.dat', ['90265', '2205']],
  [VIRTUAL_CHILD_FIGURE, expect.arrayContaining(['47510pr0002', '47511pr0001'])],
])('reviewed alias %s', (id, parts) => {
  expect(resolveLdrawPart(id as string).partNums).toEqual(parts)
})

it.each(['4268.dat', '51262.dat', '3811.dat'])('optional plate %s', (id) => {
  expect(resolveLdrawPart(id).flags.optionalBaseplate).toBe(true)
  expect(resolveLdrawPart(id).flags.unknown).toBeFalsy()
})

it.each(['3001.dat', '3003.dat', '3020.dat', '41539.dat'])('system brick known %s', (id) => {
  const resolved = resolveLdrawPart(id)
  expect(resolved.flags.unknown).toBeFalsy()
  expect(resolved.flags.nonDuplo).toBe(true)
  expect(resolved.partNums.length).toBeGreaterThan(0)
})

it.each(['47198p03.dat', '47205.dat', '47206p01.dat', '63710.dat'])('figure component %s', (id) => {
  const resolved = resolveLdrawPart(id)
  expect(resolved.flags.figureComponent).toBeTruthy()
  expect(resolved.flags.unknown).toBeFalsy()
})

it('auto-strips print suffix to reviewed shape', () => {
  expect(resolveLdrawPart('2302pr0001.dat').partNums).toEqual(['2302'])
  expect(resolveLdrawPart('2302pr0001.dat').flags.printedFlexible).toBe(true)
})

it('local Toolo stays unknown', () => {
  expect(resolveLdrawPart('31196c01.dat').flags.unknown).toBe(true)
  expect(resolveLdrawPart('unreviewed-xyz.dat').flags.unknown).toBe(true)
})

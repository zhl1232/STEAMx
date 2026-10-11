import { expect, it } from 'vitest'
import { resolveLdrawColor, resolveLdrawPart, VIRTUAL_CHILD_FIGURE } from './ldraw-part-mapping'

it.each([
  ['6345.dat', ['17562', '6345']],
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

it.each([
  ['3001.dat', '3011'],
  ['3003.dat', '3437'],
  ['3020.dat', '40666'],
  ['41539.dat', '51262'],
  ['3811.dat', '4268'],
])('System stand-in resolves to Duplo %s', (id, partNum) => {
  expect(resolveLdrawPart(id)).toEqual({
    partNums: [partNum],
    flags: id === '3811.dat' ? { optionalBaseplate: true } : {},
  })
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

it('unreviewed parts stay unknown', () => {
  expect(resolveLdrawPart('unreviewed-xyz.dat').flags.unknown).toBe(true)
})

it.each([
  ['76395', '86599'],
  ['76057', '31184c01'],
  ['28336', '45202'],
  ['28334', '74847'],
  ['28331', '74844'],
  ['60535', '86594'],
  ['74957', '74957'],
  ['99565', '99565c01'],
  ['31196c01', '31196c01'],
  ['75349', '6517'],
  ['75350', '6515'],
  ['44970', '44970'],
  ['71981', '71981'],
  ['6294', '6294'],
  ['6521', '6521'],
  ['6522', '6522'],
  ['6523', '6523'],
  ['6525', '6525'],
  ['6526', '6526'],
  ['6527', '6527'],
  ['6529', '6529'],
  ['6530', '6530'],
  ['31622', '31622'],
  ['31623', '31623'],
  ['31624', '31624'],
  ['31625', '31625'],
  ['6292', '6292'],
  ['6515', '6515'],
  ['6517', '6517'],
  ['6524', '6524'],
  ['75536', '75536'],
])('reviewed mechanical part %s', (id, partNum) => {
  expect(resolveLdrawPart(`${id}.dat`)).toEqual({ partNums: [partNum], flags: {} })
})

it.each([0, 19, 46, 47, 71, 72])('resolves exact color %s', (color) => {
  expect(resolveLdrawColor(color)).toBe(color)
})

it('leaves unreviewed colors for substitution rules', () => {
  expect(resolveLdrawColor(9999)).toBeUndefined()
})

import { expect, it } from 'vitest'
import { resolveLdrawPart } from './ldraw-part-mapping'
it.each([
  ['10715.dat', ['11248c01', '11248c02']], ['10715p01.dat', ['11248c02']],
  ['10715p02.dat', ['11248c01']], ['14639p02.dat', ['11248c01']],
  ['31021.dat', ['12602']], ['31021p01.dat', ['12602']],
  ['3437pe1.dat', ['3437pr0049', '3437pr0067', '3437']],
  ['2301b.dat', ['2301']], ['2302b.dat', ['2302']], ['98223b.dat', ['98223']],
  ['22119.dat', ['41250']], ['73162p01.dat', ['4198', '4198pr9981']],
])('reviewed alias %s', (id, parts) => expect(resolveLdrawPart(id as string).partNums).toEqual(parts))
it.each(['4268.dat', '51262.dat'])('optional plate %s', id => expect(resolveLdrawPart(id).flags.optionalBaseplate).toBe(true))
it.each(['31196c01.dat', '47198p03.dat', '47205.dat', '3001.dat', '3811.dat', 'unreviewed.dat'])('unknown %s', id => expect(resolveLdrawPart(id).flags.unknown).toBe(true))

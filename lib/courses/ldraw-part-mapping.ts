export interface PartFlags {
  colorFlexible?: boolean
  printedFlexible?: boolean
  figureFlexible?: boolean
  optionalBaseplate?: boolean
  unknown?: boolean
  nonDuplo?: boolean
  unknownWhenAbsent?: boolean
}
export interface ResolvedLdrawPart { partNums: string[]; flags: PartFlags }
export type PartResolver = (partId: string) => ResolvedLdrawPart
// Reviewed by dimensions/description against inventory, never inferred by fuzzy matching.
const aliases: Record<string, ResolvedLdrawPart> = {
  '10715': { partNums: ['11248c01', '11248c02'], flags: { colorFlexible: true } },
  '10715p01': { partNums: ['11248c02'], flags: {} },
  '10715p02': { partNums: ['11248c01'], flags: {} },
  '14639p02': { partNums: ['11248c01'], flags: {} },
  '31021': { partNums: ['12602'], flags: { colorFlexible: true } },
  '31021p01': { partNums: ['12602'], flags: { colorFlexible: true, printedFlexible: true } },
  '3437pe1': { partNums: ['3437pr0049', '3437pr0067', '3437'], flags: { printedFlexible: true } },
  '3437pe0': { partNums: ['3437pr0049', '3437pr0067', '3437'], flags: { printedFlexible: true } },
  '2301b': { partNums: ['2301'], flags: {} },
  '2302b': { partNums: ['2302'], flags: {} },
  '98223b': { partNums: ['98223'], flags: { unknownWhenAbsent: true } },
  '22119': { partNums: ['41250'], flags: {} },
  '73162p01': { partNums: ['4198', '4198pr9981'], flags: { printedFlexible: true } },
  '4198': { partNums: ['4198', '4198pr9981'], flags: { printedFlexible: true } },
  '4672a': { partNums: ['4672'], flags: {} },
  '4672b': { partNums: ['4672'], flags: {} },
  '4268': { partNums: ['4268'], flags: { optionalBaseplate: true } },
  '51262': { partNums: ['51262'], flags: { optionalBaseplate: true } },
}
const reviewedShapes = new Set('61649 90265 3011 3437 40666 6490 31452 31195 42029 31191 4196 2302 4199 2291 51708 2301 51725 31193 6394 2300 4672 31453 31111 13355 6510 92094 10199 89849 63871 11198 6345 3664 2205 6474'.split(' '))
export function resolveLdrawPart(partId: string): ResolvedLdrawPart {
  const id = partId.trim().replace(/\\/g, '/').split('/').pop()!.toLowerCase().replace(/\.dat$/, '')
  const alias = aliases[id]
  if (alias) return { partNums: [...alias.partNums], flags: { ...alias.flags } }
  if (/^(47198|47199|472\d\d|63710)/.test(id)) return { partNums: [], flags: { figureFlexible: true, unknown: true } }
  if (['3001', '3003', '3020', '41539', '3811'].includes(id)) return { partNums: [], flags: { unknown: true, nonDuplo: true } }
  if (/^31111p[0-9a-z]+$/.test(id)) return { partNums: ['31111'], flags: { printedFlexible: true } }
  if (reviewedShapes.has(id)) return { partNums: [id], flags: {} }
  return { partNums: [], flags: { unknown: true } }
}
/** Only verified classic colors; other colors match by shape and are labelled substitutions. */
const colors: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 14: 14, 15: 15, 25: 25, 27: 27, 71: 71, 72: 72 }
export function resolveLdrawColor(colorCode: number): number | undefined { return colors[colorCode] }

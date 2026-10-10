/**
 * LDraw 零件号 → Rebrickable 套装零件号。
 * 优先用手写别名；其次按印花/模具后缀回落到已审定的基础号。
 */

export interface PartFlags {
  colorFlexible?: boolean
  printedFlexible?: boolean
  /** 人物散件：由核算层折算成「完整小人」件数，不单独报未知 */
  figureComponent?: 'child' | 'adult'
  /** 每件散件折算的小人份额：手臂默认 0.5，其余 1 */
  figureUnits?: number
  optionalBaseplate?: boolean
  unknown?: boolean
  nonDuplo?: boolean
}

export interface ResolvedLdrawPart {
  partNums: string[]
  flags: PartFlags
}

export type PartResolver = (partId: string) => ResolvedLdrawPart

/** 套装里完整小人的 Rebrickable 零件号（9090/9076 库存） */
export const KIT_CHILD_FIGURE_PART_NUMS = [
  '47219pr0002',
  '47510pr0002',
  '47510pr0006',
  '47511c01pr0002',
  '47511pr0001',
  '47511pr0005',
  '47511pr0007',
] as const

/** 核算用的虚拟零件号：1 个 = 套装里 1 个完整小人 */
export const VIRTUAL_CHILD_FIGURE = '__duplo_child_figure__'

const aliases: Record<string, ResolvedLdrawPart> = {
  // 车底盘
  '10715': { partNums: ['11248c01', '11248c02'], flags: { colorFlexible: true } },
  '10715p01': { partNums: ['11248c02'], flags: {} },
  '10715p02': { partNums: ['11248c01'], flags: {} },
  '14639p02': { partNums: ['11248c01'], flags: {} },
  // 栅栏近义
  '31021': { partNums: ['12602'], flags: { colorFlexible: true } },
  '31021p01': { partNums: ['12602'], flags: { colorFlexible: true, printedFlexible: true } },
  // 眼睛砖
  '3437pe1': { partNums: ['3437pr0049', '3437pr0067', '3437'], flags: { printedFlexible: true } },
  '3437pe0': { partNums: ['3437pr0049', '3437pr0067', '3437'], flags: { printedFlexible: true } },
  // 模具变体
  '2301b': { partNums: ['2301'], flags: {} },
  '2302b': { partNums: ['2302'], flags: {} },
  // 弧顶 2×4：优先用套装里的 31213（2×4×2 弧顶）抵扣，否则记为缺 98223
  '98223': { partNums: ['31213', '98223'], flags: { colorFlexible: true } },
  '98223b': { partNums: ['31213', '98223'], flags: { colorFlexible: true } },
  // 球
  '22119': { partNums: ['41250'], flags: {} },
  // 圆端砖 / 眼睛砖
  '73162p01': { partNums: ['4198'], flags: { printedFlexible: true } },
  '4198': { partNums: ['4198'], flags: {} },
  '4672a': { partNums: ['4672'], flags: {} },
  '4672b': { partNums: ['4672'], flags: {} },
  // 门：89849/2205 可用套装窗门 90265 近义替代
  '89849': { partNums: ['90265', '89849'], flags: { printedFlexible: true } },
  '2205': { partNums: ['90265', '2205'], flags: { printedFlexible: true } },
  // 可选底板
  '4268': { partNums: ['4268'], flags: { optionalBaseplate: true } },
  '51262': { partNums: ['51262'], flags: { optionalBaseplate: true } },
  '3811': { partNums: ['3811'], flags: { optionalBaseplate: true, nonDuplo: true } },
  // 小颗粒（不在大颗粒套装里，但已知 → 记必需缺件，不标未知）
  '3001': { partNums: ['3001'], flags: { nonDuplo: true } },
  '3003': { partNums: ['3003'], flags: { nonDuplo: true } },
  '3020': { partNums: ['3020'], flags: { nonDuplo: true } },
  '41539': { partNums: ['41539'], flags: { nonDuplo: true } },
  // 人物散件 → 由核算层折算
  '47198': { partNums: [], flags: { figureComponent: 'child', figureUnits: 0.5 } },
  '47198p03': { partNums: [], flags: { figureComponent: 'child', figureUnits: 0.5 } },
  '47199': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47203': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47203p03': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47204': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47205': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47206': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47206p01': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '47207': { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } },
  '63710': { partNums: [], flags: { figureComponent: 'adult', figureUnits: 1 } },
}

/** 已对照过套装/课程的基础零件号（无印花后缀） */
const reviewedShapes = new Set(
  (
    '61649 90265 3011 3437 40666 6490 31452 31195 42029 31191 4196 2302 4199 2291 ' +
    '51708 2301 51725 31193 6394 2300 4672 31453 31111 13355 6510 92094 10199 ' +
    '63871 11198 6345 3664 6474 31213 44524 4198 12602 11248c01 11248c02 41250'
  ).split(/\s+/),
)

function stripPrintAndMold(id: string): string[] {
  const out: string[] = []
  // 3437pe1 / 3437pr0049 / 31021p01
  const print = id.match(/^(.+?)(?:pe\d*|pr\d+|p\d+)$/i)
  if (print) out.push(print[1].toLowerCase())
  // 2302b / 98223b
  const mold = id.match(/^(.+?)b$/i)
  if (mold && mold[1].length >= 3) out.push(mold[1].toLowerCase())
  // 31111pxx already covered; 11248c01 keep as-is
  return out
}

export function normalizeLdrawPartId(partId: string): string {
  return partId.trim().replace(/\\/g, '/').split('/').pop()!.toLowerCase().replace(/\.dat$/, '')
}

export function resolveLdrawPart(partId: string): ResolvedLdrawPart {
  const id = normalizeLdrawPartId(partId)

  if (id === VIRTUAL_CHILD_FIGURE) {
    return { partNums: [...KIT_CHILD_FIGURE_PART_NUMS], flags: { colorFlexible: true } }
  }

  const alias = aliases[id]
  if (alias) return { partNums: [...alias.partNums], flags: { ...alias.flags } }

  // 人物散件通配（未逐条写进 aliases 的印花变体）
  if (/^47198/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 0.5 } }
  if (/^47199/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47203/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47204/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47205/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47206/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47207/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^63710/.test(id)) return { partNums: [], flags: { figureComponent: 'adult', figureUnits: 1 } }
  if (/^47219|^47510|^47511/.test(id)) {
    return { partNums: [id], flags: { colorFlexible: true } }
  }

  // 本地简化 Toolo：套装无对应件
  if (/^31196/.test(id)) return { partNums: [], flags: { unknown: true } }

  // 印花砖 → 素色基础号
  if (/^31111p[0-9a-z]+$/.test(id)) {
    return { partNums: ['31111'], flags: { printedFlexible: true } }
  }

  if (reviewedShapes.has(id)) return { partNums: [id], flags: {} }

  for (const base of stripPrintAndMold(id)) {
    if (aliases[base]) {
      const a = aliases[base]
      return {
        partNums: [...a.partNums],
        flags: { ...a.flags, printedFlexible: true },
      }
    }
    if (reviewedShapes.has(base)) {
      return { partNums: [base], flags: { printedFlexible: true } }
    }
  }

  return { partNums: [], flags: { unknown: true } }
}

/** 仅收录已核对的经典色；其余按形状匹配并标为换色。 */
const colors: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  10: 10, 14: 14, 15: 15, 25: 25, 27: 27, 70: 70, 71: 71, 72: 72, 73: 73,
}

export function resolveLdrawColor(colorCode: number): number | undefined {
  return colors[colorCode]
}

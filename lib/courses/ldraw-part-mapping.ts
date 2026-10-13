import inventories from './ldraw-kit-inventories.json'

/**
 * LDraw 零件号 → Rebrickable 套装零件号。
 * 优先用手写别名；其次按印花/模具后缀回落到已审定的基础号。
 */

export interface PartFlags {
  /** 模型配色仅为示意，以实际分配的套装颜色为准。 */
  kitColor?: boolean
  colorFlexible?: boolean
  printedFlexible?: boolean
  /** 同形状、同展示色的 2×2 眼睛印刷编号等价；素色砖仍是替代。 */
  eyePrintEquivalent?: boolean
  /** 已确认存在形状差异的替代件中文名称；普通别名不在此列。 */
  shapeAlternatives?: Record<string, string>
  /** 人物散件：由核算层折算成「完整小人」件数，不单独报未知 */
  figureComponent?: 'child' | 'adult'
  /** 每件散件折算的小人份额：手臂默认 0.5，其余 1 */
  figureUnits?: number
  optionalBaseplate?: boolean
  unknown?: boolean
}

export interface ResolvedLdrawPart {
  partNums: string[]
  flags: PartFlags
}

export type PartResolver = (partId: string, description?: string) => ResolvedLdrawPart

const eyePrintPartNums = [...new Set(Object.values(inventories).flatMap((kit) =>
  kit.parts.filter((part) => /^3437pr\d+$/.test(part.partNum) && /\beyes?\b/i.test(part.name))
    .map((part) => part.partNum),
))]

/** 限定 3437 的眼睛印刷，避免把其它图案或其它形状的眼睛件视为等价。 */
export function isDuploEyePrint(partId: string, description = ''): boolean {
  const id = normalizeLdrawPartId(partId)
  return /^3437pe\d+$/.test(id) || eyePrintPartNums.includes(id) ||
    (/^3437p[0-9a-z]+$/.test(id) && /\beyes?\b|眼睛/i.test(description))
}

/** 教育套装库存的完整小人（含成人）；保留 CHILD 常量名以兼容调用方 */
export const KIT_CHILD_FIGURE_PART_NUMS = [
  '10111c01pr0005',
  '47202pr9999',
  '75115pr0006',
  '75115pr0012',
  '75121pr0008',
  '47511pr0006',
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

/** 大颗粒课程模型中以 System 比例绘制的 Duplo 替身零件。 */
export const SYSTEM_TO_DUPLO_STAND_INS: Record<
  string,
  { partId: string; partName: string; partDescription: string }
> = {
  '3001': { partId: '3011.dat', partName: '2×4 积木', partDescription: 'Duplo Brick 2 x 4' },
  '3003': { partId: '3437.dat', partName: '2×2 积木', partDescription: 'Duplo Brick 2 x 2' },
  '3020': { partId: '40666.dat', partName: '2×4 薄板', partDescription: 'Duplo Plate 2 x 4' },
  '41539': { partId: '51262.dat', partName: '8×8 薄板', partDescription: 'Duplo Plate 8 x 8' },
  '3811': { partId: '4268.dat', partName: '24×24 底板', partDescription: 'Duplo Baseplate 24 x 24' },
}

const kitColorParts = new Set(
  "76395 76057 28336 28334 28331 60535 74957 99565 6294 44970 71981 31196c01 6521 6522 6523 6524 6525 6526 6527 6528 6529 6530 31622 31623 31624 31625 6292 6515 6517 75349 75350 75536".split(" "),
)

const aliases: Record<string, ResolvedLdrawPart> = {
  // Toolo / Duplo Technic：已核对的零件别名
  '76395': { partNums: ['86599'], flags: {} }, // element 6182798
  '76057': { partNums: ['31184c01'], flags: {} }, // element 6182720
  '28336': { partNums: ['45202'], flags: {} }, // element 6162848
  '28334': { partNums: ['74847'], flags: {} }, // element 6162840
  '28331': { partNums: ['74844'], flags: {} }, // element 6162831
  '60535': { partNums: ['86594'], flags: {} }, // element 6182698
  '74957': { partNums: ['74957'], flags: {} }, // element 6139202
  '99565': { partNums: ['99565c01'], flags: {} },
  '31196c01': { partNums: ['31196c01'], flags: {} },
  '75349': { partNums: ['6517'], flags: {} },
  '75350': { partNums: ['6515'], flags: {} },
  // Duplo Windscreen 4 x 4 x 2 Curved（45002 的透明黄色挡风玻璃）
  '6345': { partNums: ['17562', '6345'], flags: {} },
  // 车底盘
  '10715': { partNums: ['11248c01', '11248c02'], flags: { colorFlexible: true } },
  '10715p01': { partNums: ['11248c02'], flags: {} },
  '10715p02': { partNums: ['11248c01'], flags: {} },
  '14639p02': { partNums: ['11248c01'], flags: {} },
  // 栅栏近义
  '31021': { partNums: ['12602'], flags: { colorFlexible: true } },
  '31021p01': { partNums: ['12602'], flags: { colorFlexible: true, printedFlexible: true } },
  // 模具变体
  '2301b': { partNums: ['2301'], flags: {} },
  '2302b': { partNums: ['2302'], flags: {} },
  // 弧顶 2×4：优先用套装里的 31213（2×4×2 弧顶）抵扣，否则记为缺 98223
  '98223': { partNums: ['31213', '98223'], flags: { colorFlexible: true, shapeAlternatives: { '31213': '2×4×2 弧顶积木' } } },
  '98223b': { partNums: ['31213', '98223'], flags: { colorFlexible: true, shapeAlternatives: { '31213': '2×4×2 弧顶积木' } } },
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
  '3811': { partNums: ['4268'], flags: { optionalBaseplate: true } },
  // 大颗粒课程模型里的 System 替身 → 实际 Duplo 零件
  '3001': { partNums: ['3011'], flags: {} },
  '3003': { partNums: ['3437'], flags: {} },
  '3020': { partNums: ['40666'], flags: {} },
  '41539': { partNums: ['51262'], flags: {} },
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
    '63871 11198 6345 3664 6474 31213 44524 4198 12602 11248c01 11248c02 41250 ' +
    '44970 71981 6294 6521 6522 6523 6525 6526 6527 6529 6530 31622 31623 31624 31625 6292 6515 6517 6524 75536'
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

export function resolveLdrawPart(partId: string, description?: string): ResolvedLdrawPart {
  const id = normalizeLdrawPartId(partId)

  if (isDuploEyePrint(id, description)) {
    return {
      partNums: [...new Set([...eyePrintPartNums, ...(/^3437pe\d+$/.test(id) ? [] : [id]), '3437'])],
      flags: { printedFlexible: true, eyePrintEquivalent: true },
    }
  }

  if (id === VIRTUAL_CHILD_FIGURE) {
    return { partNums: [...KIT_CHILD_FIGURE_PART_NUMS], flags: { colorFlexible: true } }
  }

  const alias = aliases[id]
  if (alias) return { partNums: [...alias.partNums], flags: { ...alias.flags, ...(kitColorParts.has(id) ? { kitColor: true } : {}) } }

  // 人物散件通配（未逐条写进 aliases 的印花变体）
  if (/^47198/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 0.5 } }
  if (/^47199/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47203/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47204/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47205/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47206/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^47207/.test(id)) return { partNums: [], flags: { figureComponent: 'child', figureUnits: 1 } }
  if (/^63710/.test(id)) return { partNums: [], flags: { figureComponent: 'adult', figureUnits: 1 } }
  if ((KIT_CHILD_FIGURE_PART_NUMS as readonly string[]).includes(id) || /^47219|^47510|^47511/.test(id)) {
    return { partNums: [id], flags: { colorFlexible: true } }
  }

  // 印花砖 → 素色基础号
  if (/^31111p[0-9a-z]+$/.test(id)) {
    return { partNums: ['31111'], flags: { printedFlexible: true } }
  }

  if (kitColorParts.has(id)) return { partNums: [id], flags: { kitColor: true } }
  if (reviewedShapes.has(id)) return { partNums: [id], flags: {} }

  for (const base of stripPrintAndMold(id)) {
    if (aliases[base]) {
      const a = aliases[base]
      return {
        partNums: [...a.partNums],
        flags: { ...a.flags, printedFlexible: !id.endsWith("b"), ...(kitColorParts.has(base) ? { kitColor: true } : {}) },
      }
    }
    if (reviewedShapes.has(base)) {
      return { partNums: [base], flags: { printedFlexible: !id.endsWith("b"), ...(kitColorParts.has(base) ? { kitColor: true } : {}) } }
    }
  }

  return { partNums: [], flags: { unknown: true } }
}

/** 仅收录已核对的经典色；其余按形状匹配并标为换色。 */
const colors: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  10: 10, 14: 14, 15: 15, 19: 19, 46: 46, 47: 47, 25: 25, 27: 27, 70: 70, 71: 71, 72: 72, 73: 73,
}

export function resolveLdrawColor(colorCode: number): number | undefined {
  return colors[colorCode]
}

import inventories from './ldraw-kit-inventories.json'
import { hasKitComparison, type KitSelection } from './course-kit-config'
import type { LessonMaterialPreferences } from './lesson-material-preferences'
import {
  normalizeLdrawPartId,
  SYSTEM_TO_DUPLO_STAND_INS,
  resolveLdrawColor,
  resolveLdrawPart,
  VIRTUAL_CHILD_FIGURE,
  type PartResolver,
  type ResolvedLdrawPart,
} from './ldraw-part-mapping'
import type { LdrawBom, LdrawBomEntry } from '../utils/ldraw-bom'

/** 为 Duplo 课程还原替身零件并识别结构薄板；全课和分步清单使用相同口径。 */
export function prepareLessonBomForCourse(courseId: number, bom: LdrawBom): LdrawBom {
  if (!hasKitComparison(courseId)) return bom

  const prepareEntries = (entries: LdrawBomEntry[]): LdrawBomEntry[] => {
    const merged = new Map<string, LdrawBomEntry>()
    for (const entry of entries) {
      const id = normalizeLdrawPartId(entry.partId)
      const replacement = Object.hasOwn(SYSTEM_TO_DUPLO_STAND_INS, id)
        ? SYSTEM_TO_DUPLO_STAND_INS[id]
        : undefined
      const prepared = { ...entry, ...replacement }
      const key = `${normalizeLdrawPartId(prepared.partId)}|${prepared.colorCode}`
      const previous = merged.get(key)
      if (previous) {
        previous.count += prepared.count
        if (prepared.structural) previous.structural = true
      } else merged.set(key, prepared)
    }
    return [...merged.values()].sort((a, b) => b.count - a.count)
  }

  const entries = prepareEntries(bom.entries)
  const steps = bom.steps.map((step) => ({ ...step, entries: prepareEntries(step.entries) }))
  const partColorKey = (entry: LdrawBomEntry) =>
    `${normalizeLdrawPartId(entry.partId)}|${entry.colorCode}`
  const structuralPlates = new Set<string>()
  for (const step of steps) {
    if (step.stepIndex <= 0) continue
    for (const entry of step.entries) {
      if (
        normalizeLdrawPartId(entry.partId) === '51262' &&
        resolveLdrawPart(entry.partId).flags.optionalBaseplate
      ) {
        structuralPlates.add(partColorKey(entry))
      }
    }
  }
  // 同号同色在后续步骤用于连接时，全课和所有分步行都必须备齐；24×24 底板不自动标记。
  for (const entry of [...entries, ...steps.flatMap((step) => step.entries)]) {
    if (structuralPlates.has(partColorKey(entry))) entry.structural = true
  }
  return {
    ...bom,
    entries,
    kindCount: entries.length,
    steps,
  }
}

export interface KitInventoryPart {
  partNum: string
  name: string
  colorId: number
  colorName: string
  quantity: number
}

export interface KitInventory {
  setNum: string
  name: string
  totalQuantity: number
  source: string
  parts: KitInventoryPart[]
}

export const kitInventories: Record<string, KitInventory> = inventories

export const DUPLO_8X8_PLATE_STUDS = 64
/** 按优先顺序消耗：先用两块 4×8，再用较大的 8×16；不包含 2×8。 */
export const AREA_PLATE_SUBSTITUTES = [
  { partNum: '4672', studs: 32, areaLabel: '4×8 薄板' },
  { partNum: '6490', studs: 128, areaLabel: '8×16 薄板' },
] as const

export function mergeKitInventories(kits: KitSelection[]): KitInventoryPart[] {
  const merged = new Map<string, KitInventoryPart>()
  for (const kit of kits) {
    if (!Number.isSafeInteger(kit.copies) || kit.copies < 0) throw new Error('套数须为非负整数')
    if (!kitInventories[kit.setNum]) throw new Error(`未配置套装库存：${kit.setNum}`)
    for (const part of kitInventories[kit.setNum].parts) {
      const key = `${part.partNum}|${part.colorId}`
      const previous = merged.get(key)
      merged.set(key, {
        ...part,
        quantity: (previous?.quantity ?? 0) + part.quantity * kit.copies,
      })
    }
  }
  return [...merged.values()]
}

export type MaterialStatus =
  | 'satisfied'
  | 'colorSubstitute'
  | 'optionalMissing'
  | 'requiredMissing'
  | 'unknown'

export interface MaterialRequirement extends LdrawBomEntry {
  status: MaterialStatus
  mapping: ResolvedLdrawPart
  matched: number
  substituted: number
  missing: number
  allocations: {
    partNum: string
    colorId: number
    colorName: string
    quantity: number
    substitute: boolean
    /** 面积替代时，实际消耗的薄板尺寸。 */
    areaLabel?: string
  }[]
  /** 由人物散件折算而来 */
  figureFolded?: boolean
}

function isUnknown(entry: MaterialRequirement): boolean {
  if (entry.mapping.flags.unknown) return true
  if (entry.mapping.flags.figureComponent) return false
  if (!entry.mapping.partNums.length) return true
  return false
}

function isOptional(
  entry: MaterialRequirement,
  prefs: LessonMaterialPreferences,
): boolean {
  if (entry.structural) return false
  return (
    !!entry.mapping.flags.optionalBaseplate &&
    !prefs.includeOptionalBaseplates &&
    !prefs.structuralBaseplates.includes(entry.partId)
  )
}

/**
 * 把人物散件折成「需要几个完整小人」。
 * 规则：手臂按 0.5 计，头/身/髋/腿/帽/铰链按 1 计；取各角色折算后的最大值（向上取整）。
 * 成人小人暂与儿童共用套装小人库存（套装无成人件）。
 */
export function foldFigureComponents(
  entries: MaterialRequirement[],
): { remaining: MaterialRequirement[]; figureDemand: number; folded: MaterialRequirement[] } {
  const folded: MaterialRequirement[] = []
  const remaining: MaterialRequirement[] = []
  let armUnits = 0
  const roleMax = new Map<string, number>()

  for (const entry of entries) {
    const role = entry.mapping.flags.figureComponent
    if (!role) {
      remaining.push(entry)
      continue
    }
    folded.push(entry)
    const units = (entry.mapping.flags.figureUnits ?? 1) * entry.count
    if ((entry.mapping.flags.figureUnits ?? 1) < 1) {
      armUnits += units
    } else {
      // 同一类角色（头/身/…）跨颜色合并
      const key = entry.partId.replace(/\.dat$/i, '').replace(/(p|pr|pe)\w+$/i, '')
      roleMax.set(key, (roleMax.get(key) ?? 0) + entry.count)
    }
  }

  const byRole = Math.max(0, ...roleMax.values())
  const byArms = Math.ceil(armUnits)
  const figureDemand = Math.max(byRole, byArms)

  return { remaining, figureDemand, folded }
}

function allocateStock(
  entries: MaterialRequirement[],
  stock: KitInventoryPart[],
  prefs: LessonMaterialPreferences,
): void {
  const order = [...entries].sort(
    (a, b) => Number(isOptional(a, prefs)) - Number(isOptional(b, prefs)),
  )

  for (const substitutePass of [false, true] as const) {
    for (const entry of order) {
      if (isUnknown(entry)) continue
      const colorId = resolveLdrawColor(entry.colorCode)
      if (substitutePass && colorId !== undefined && !prefs.acceptColorSubstitutes) continue

      for (const partNum of entry.mapping.partNums) {
        for (const part of stock) {
          if (!entry.missing || part.quantity <= 0 || part.partNum !== partNum) continue
          const exact = colorId !== undefined && part.colorId === colorId
          // substitutePass=false → 只要精确色；=true → 只要非精确（或颜色未知）
          if (colorId !== undefined) {
            if (exact === substitutePass) continue
          } else if (!substitutePass) {
            continue
          }

          const quantity = Math.min(entry.missing, part.quantity)
          part.quantity -= quantity
          entry.missing -= quantity
          entry.matched += quantity
          const substitute =
            !exact ||
            !!entry.mapping.flags.printedFlexible ||
            !!entry.mapping.flags.colorFlexible ||
            !!entry.figureFolded
          if (substitute) entry.substituted += quantity
          entry.allocations.push({
            partNum,
            colorId: part.colorId,
            colorName: part.colorName,
            quantity,
            substitute,
          })
        }
      }
    }
  }
}

/** 普通分配后，仅用剩余薄板面积覆盖必需的 8×8；整块消耗，多余面积不回库存。 */
export function allocateAreaPlateSubstitutes(
  entries: MaterialRequirement[],
  stock: KitInventoryPart[],
  prefs: LessonMaterialPreferences,
): void {
  const demands = entries
    .filter((entry) =>
      normalizeLdrawPartId(entry.partId) === '51262' &&
      entry.missing > 0 && !isOptional(entry, prefs) && !isUnknown(entry),
    )
    .map((entry) => ({
      entry,
      originalMissing: entry.missing,
      studsStillNeeded: entry.missing * DUPLO_8X8_PLATE_STUDS,
    }))

  // 全部需求先取同色，避免其它颜色替代先占用后续行的同色库存。
  for (const substituteColor of [false, true]) {
    if (substituteColor && !prefs.acceptColorSubstitutes) continue
    for (const demand of demands) {
      const colorId = resolveLdrawColor(demand.entry.colorCode)
      for (const plate of AREA_PLATE_SUBSTITUTES) {
        for (const part of stock) {
          if (demand.studsStillNeeded <= 0 || part.quantity <= 0 || part.partNum !== plate.partNum) continue
          if (!substituteColor && (colorId === undefined || part.colorId !== colorId)) continue

          const quantity = Math.min(part.quantity, Math.ceil(demand.studsStillNeeded / plate.studs))
          part.quantity -= quantity
          demand.studsStillNeeded -= quantity * plate.studs
          demand.entry.allocations.push({
            partNum: part.partNum,
            colorId: part.colorId,
            colorName: part.colorName,
            quantity,
            substitute: true,
            areaLabel: plate.areaLabel,
          })
        }
      }
    }
  }

  for (const { entry, originalMissing, studsStillNeeded } of demands) {
    const piecesCovered = originalMissing - Math.ceil(Math.max(0, studsStillNeeded) / DUPLO_8X8_PLATE_STUDS)
    entry.missing -= piecesCovered
    entry.matched += piecesCovered
    entry.substituted += piecesCovered
  }
}

export function compareLessonMaterials(
  bom: LdrawBom,
  inventory: KitInventoryPart[],
  prefs: LessonMaterialPreferences,
  resolver: PartResolver = resolveLdrawPart,
) {
  const stock = inventory.map((part) => ({ ...part }))
  const raw: MaterialRequirement[] = bom.entries.map((entry) => ({
    ...entry,
    mapping: resolver(entry.partId),
    status: 'satisfied' as MaterialStatus,
    matched: 0,
    substituted: 0,
    missing: entry.count,
    allocations: [],
  }))

  const { remaining, figureDemand, folded } = foldFigureComponents(raw)

  // 散件本身不再进入缺件/未知列表；状态记为已由小人折算覆盖
  for (const entry of folded) {
    entry.figureFolded = true
    entry.missing = 0
    entry.matched = entry.count
    entry.status = 'satisfied'
  }

  if (figureDemand > 0) {
    remaining.push({
      partId: `${VIRTUAL_CHILD_FIGURE}.dat`,
      partName: '完整小人（儿童）',
      partDescription:
        '由模型中的头、身体、手臂、腿等人物散件折算；用套装里的完整小人抵扣',
      colorCode: 15,
      colorName: '不限色',
      colorHex: '#FFFFFF',
      count: figureDemand,
      mapping: resolver(VIRTUAL_CHILD_FIGURE),
      status: 'satisfied',
      matched: 0,
      substituted: 0,
      missing: figureDemand,
      allocations: [],
      figureFolded: true,
    })
  }

  allocateStock(remaining, stock, prefs)
  allocateAreaPlateSubstitutes(remaining, stock, prefs)

  for (const entry of remaining) {
    if (isUnknown(entry)) {
      entry.status = 'unknown'
    } else if (entry.missing) {
      entry.status = isOptional(entry, prefs) ? 'optionalMissing' : 'requiredMissing'
    } else if (entry.substituted) {
      entry.status = 'colorSubstitute'
    } else {
      entry.status = 'satisfied'
    }
  }

  const entries = [...remaining, ...folded]
  const requiredMissing = remaining.filter((e) => e.status === 'requiredMissing')
  const optionalMissing = remaining.filter((e) => e.status === 'optionalMissing')
  const unknown = remaining.filter((e) => e.status === 'unknown')
  // 小人折算本身就是「整人替代散件」，不放进换色列表，避免家长误以为要换颜色。
  const colorSubstitutes = remaining.filter((e) => e.substituted > 0 && !e.figureFolded)
  const sum = (rows: MaterialRequirement[], field: 'missing' | 'substituted') =>
    rows.reduce((n, row) => n + row[field], 0)

  return {
    entries,
    requiredMissing,
    optionalMissing,
    unknown,
    colorSubstitutes,
    foldedFigures: folded,
    figureDemand,
    stats: {
      requiredMissing: sum(requiredMissing, 'missing'),
      optionalMissing: sum(optionalMissing, 'missing'),
      unknown: sum(unknown, 'missing'),
      substituted: sum(colorSubstitutes, 'substituted'),
      matched: remaining.reduce((n, e) => n + e.matched, 0) + folded.reduce((n, e) => n + e.matched, 0),
      total: bom.partCount,
      figureDemand,
    },
  }
}

export type LessonMaterialsResult = ReturnType<typeof compareLessonMaterials>

export interface MaterialOutcome {
  /** complete：套装零件够用；short：还差必需零件 */
  status: 'complete' | 'short'
  /** 还差几种（按零件+颜色计） */
  missingKinds: number
  /** 还差几块 */
  missingPieces: number
  /** 套装里没有、需单独准备的特殊件块数 */
  specialPieces: number
}

/** 页面顶部一句话结论用的汇总。 */
export function summarizeMaterialOutcome(result: LessonMaterialsResult): MaterialOutcome {
  const missingPieces = result.stats.requiredMissing
  return {
    status: missingPieces > 0 ? 'short' : 'complete',
    missingKinds: result.requiredMissing.length,
    missingPieces,
    specialPieces: result.stats.unknown,
  }
}

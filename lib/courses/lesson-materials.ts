import inventories from './ldraw-kit-inventories.json'
import type { KitSelection } from './course-kit-config'
import type { LessonMaterialPreferences } from './lesson-material-preferences'
import {
  resolveLdrawColor,
  resolveLdrawPart,
  VIRTUAL_CHILD_FIGURE,
  type PartResolver,
  type ResolvedLdrawPart,
} from './ldraw-part-mapping'
import type { LdrawBom, LdrawBomEntry } from '../utils/ldraw-bom'

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
  }[]
  /** 由人物散件折算而来 */
  figureFolded?: boolean
}

function isUnknown(entry: MaterialRequirement, stock: KitInventoryPart[]): boolean {
  if (entry.mapping.flags.unknown) return true
  if (entry.mapping.flags.figureComponent) return false
  if (!entry.mapping.partNums.length) return true
  return false
}

function isOptional(
  entry: MaterialRequirement,
  prefs: LessonMaterialPreferences,
): boolean {
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
      if (isUnknown(entry, stock)) continue
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

  for (const entry of remaining) {
    if (isUnknown(entry, stock)) {
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
  const colorSubstitutes = remaining.filter((e) => e.substituted > 0)
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

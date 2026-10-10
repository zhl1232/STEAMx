import inventories from './ldraw-kit-inventories.json'
import type { KitSelection } from './course-kit-config'
import type { LessonMaterialPreferences } from './lesson-material-preferences'
import { resolveLdrawColor, resolveLdrawPart, type PartResolver, type ResolvedLdrawPart } from './ldraw-part-mapping'
import type { LdrawBom, LdrawBomEntry } from '../utils/ldraw-bom'
export interface KitInventoryPart { partNum: string; name: string; colorId: number; colorName: string; quantity: number }
export interface KitInventory { setNum: string; name: string; totalQuantity: number; source: string; parts: KitInventoryPart[] }
export const kitInventories: Record<string, KitInventory> = inventories
export function mergeKitInventories(kits: KitSelection[]): KitInventoryPart[] {
  const merged = new Map<string, KitInventoryPart>()
  for (const kit of kits) {
    if (!Number.isSafeInteger(kit.copies) || kit.copies < 0) throw new Error('套数须为非负整数')
    if (!kitInventories[kit.setNum]) throw new Error(`未配置套装库存：${kit.setNum}`)
    for (const part of kitInventories[kit.setNum].parts) {
      const key = `${part.partNum}|${part.colorId}`
      const previous = merged.get(key)
      merged.set(key, { ...part, quantity: (previous?.quantity ?? 0) + part.quantity * kit.copies })
    }
  }
  return [...merged.values()]
}
export type MaterialStatus = 'satisfied' | 'colorSubstitute' | 'optionalMissing' | 'requiredMissing' | 'unknown'
export interface MaterialRequirement extends LdrawBomEntry {
  status: MaterialStatus
  mapping: ResolvedLdrawPart
  matched: number
  substituted: number
  missing: number
  allocations: { partNum: string; colorId: number; colorName: string; quantity: number; substitute: boolean }[]
}
export function compareLessonMaterials(bom: LdrawBom, inventory: KitInventoryPart[], prefs: LessonMaterialPreferences, resolver: PartResolver = resolveLdrawPart) {
  const stock = inventory.map(part => ({ ...part }))
  const entries: MaterialRequirement[] = bom.entries.map(entry => ({ ...entry, mapping: resolver(entry.partId), status: 'satisfied', matched: 0, substituted: 0, missing: entry.count, allocations: [] }))
  const isUnknown = (entry: MaterialRequirement) => entry.mapping.flags.unknown || !entry.mapping.partNums.length || (entry.mapping.flags.unknownWhenAbsent && !stock.some(p => entry.mapping.partNums.includes(p.partNum)))
  const optional = (entry: MaterialRequirement) => entry.mapping.flags.optionalBaseplate && !prefs.includeOptionalBaseplates && !prefs.structuralBaseplates.includes(entry.partId)
  // Mandatory demands precede optional plates. Exact colors across ALL demands precede substitutes.
  const order = [...entries].sort((a, b) => Number(Boolean(optional(a))) - Number(Boolean(optional(b))))
  for (const substitutePass of [false, true]) {
    for (const entry of order) {
      if (isUnknown(entry)) continue
      const colorId = resolveLdrawColor(entry.colorCode)
      if (substitutePass && colorId !== undefined && !prefs.acceptColorSubstitutes) continue
      for (const partNum of entry.mapping.partNums) {
        for (const part of stock) {
          if (!entry.missing || part.quantity <= 0 || part.partNum !== partNum) continue
          const exact = colorId !== undefined && part.colorId === colorId
          if (exact === substitutePass) continue
          const quantity = Math.min(entry.missing, part.quantity)
          part.quantity -= quantity
          entry.missing -= quantity
          entry.matched += quantity
          const substitute = !exact || !!entry.mapping.flags.printedFlexible || !!entry.mapping.flags.colorFlexible
          if (substitute) entry.substituted += quantity
          entry.allocations.push({ partNum, colorId: part.colorId, colorName: part.colorName, quantity, substitute })
        }
      }
    }
  }
  for (const entry of entries) {
    entry.status = isUnknown(entry) ? 'unknown' : entry.missing ? optional(entry) ? 'optionalMissing' : 'requiredMissing' : entry.substituted ? 'colorSubstitute' : 'satisfied'
  }
  const requiredMissing = entries.filter(e => e.status === 'requiredMissing')
  const optionalMissing = entries.filter(e => e.status === 'optionalMissing')
  const unknown = entries.filter(e => e.status === 'unknown')
  // Partial fulfillment can have both missing pieces and substitutions.
  const colorSubstitutes = entries.filter(e => e.substituted > 0)
  const sum = (rows: MaterialRequirement[], field: 'missing' | 'substituted') => rows.reduce((n, row) => n + row[field], 0)
  return { entries, requiredMissing, optionalMissing, unknown, colorSubstitutes, stats: { requiredMissing: sum(requiredMissing, 'missing'), optionalMissing: sum(optionalMissing, 'missing'), unknown: sum(unknown, 'missing'), substituted: sum(colorSubstitutes, 'substituted'), matched: entries.reduce((n, e) => n + e.matched, 0), total: bom.partCount } }
}

import materialCatalog from './household-materials.data.json'
import { MATERIAL_FAMILIES, MATERIAL_GROUP_ALIASES, MATERIAL_TAXONOMY, MATERIAL_TERM_ALIASES } from './material-taxonomy'
export { MATERIAL_SECTIONS } from './material-taxonomy'

export type HouseholdMaterialGroup = {
  id: string
  label: string
  memberIds: string[]
  aliases: string[]
  section: string
  common?: boolean
  featured?: boolean
  /** Only an explicitly generic requirement is confirmed by a category selection. */
  baseId?: string
}

const termsById = new Map(MATERIAL_TAXONOMY.map((term) => [term.id, term]))
const familiesById = new Map(MATERIAL_FAMILIES.map((family) => [family.id, family]))
const groups = new Map<string, HouseholdMaterialGroup>()
const groupIdByMaterial = new Map<string, string>()
for (const material of materialCatalog as readonly { id: string; label: string; canonicalId?: string; description?: string; common?: boolean }[]) {
  const term = termsById.get(material.canonicalId ?? material.id)
  // Unreviewed additions are deliberately not exposed as guessed categories.
  // Catalog coverage tests require an explicit vocabulary entry before shipping.
  if (!term) continue
  const family = familiesById.get(term.groupId)!
  const group = groups.get(family.id) ?? {
    id: family.id, label: family.name, section: family.section, memberIds: [], aliases: [],
    ...(family.baseId ? { baseId: family.baseId } : {}),
    ...(family.featured ? { featured: true } : {}),
  }
  group.memberIds.push(material.id)
  group.aliases.push(material.label, ...(material.description ? [material.description] : []))
  if (material.common) group.common = true
  groups.set(group.id, group)
  groupIdByMaterial.set(material.id, group.id)
}
for (const alias of MATERIAL_TERM_ALIASES) {
  const groupId = alias.groupId ?? (alias.targetId ? termsById.get(alias.targetId)?.groupId : undefined)
  const group = groupId ? groups.get(groupId) : undefined
  if (group && !group.aliases.includes(alias.sourceLabel)) group.aliases.push(alias.sourceLabel)
}

export const HOUSEHOLD_MATERIAL_GROUPS: readonly HouseholdMaterialGroup[] = [...groups.values()]
export const MATERIAL_GROUPS_BY_ID = new Map(HOUSEHOLD_MATERIAL_GROUPS.map((group) => [group.id, group]))

export function getMaterialGroupId(id: string): string | undefined {
  if (MATERIAL_GROUPS_BY_ID.has(id)) return id
  const migrated = Object.hasOwn(MATERIAL_GROUP_ALIASES, id) ? MATERIAL_GROUP_ALIASES[id] : undefined
  if (migrated) return migrated
  // Former singleton categories remain valid only for actual catalog identities.
  return groupIdByMaterial.get(id.startsWith('group:') ? id.slice('group:'.length) : id)
}

export function getMaterialSelectionCount(ids: readonly string[]): number {
  return new Set(ids.map(getMaterialGroupId).filter(Boolean)).size
}

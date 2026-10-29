import taxonomyData from './material-taxonomy.data.json'

export type MaterialTerm = { name: string; specification?: string }
export type MaterialTaxonomyEntry = MaterialTerm & { id: string; sourceLabel: string; groupId: string; section: string }
export type MaterialFamily = { id: string; name: string; section: string; baseId?: string; featured?: boolean }

type MaterialAlias = { id?: string; sourceLabel: string; targetId?: string; groupId?: string; specification?: string }

/** One reviewed vocabulary shared by project presentation and household selection. */
export const MATERIAL_TAXONOMY: readonly MaterialTaxonomyEntry[] = taxonomyData.terms
export const MATERIAL_FAMILIES: readonly MaterialFamily[] = taxonomyData.families
export const MATERIAL_SECTIONS: readonly { id: string; label: string }[] = taxonomyData.sections
export const MATERIAL_GROUP_ALIASES: Readonly<Record<string, string>> = taxonomyData.groupAliases
export const MATERIAL_TERM_ALIASES: readonly MaterialAlias[] = taxonomyData.aliases

const termsById = new Map(MATERIAL_TAXONOMY.map((term) => [term.id, term]))
const familiesById = new Map(MATERIAL_FAMILIES.map((family) => [family.id, family]))
const termsByLabel = new Map<string, MaterialTerm>()
for (const term of MATERIAL_TAXONOMY) {
  termsByLabel.set(term.sourceLabel, { name: term.name, ...(term.specification ? { specification: term.specification } : {}) })
}
for (const alias of MATERIAL_TERM_ALIASES) {
  const term = alias.targetId ? termsById.get(alias.targetId) : undefined
  const family = alias.groupId ? familiesById.get(alias.groupId) : undefined
  if ((!term && !family) || (alias.targetId && alias.groupId)) throw new Error(`Invalid material alias target: ${alias.sourceLabel}`)
  const name = term?.name ?? family!.name
  const specifications = [term?.specification, alias.specification].filter((value): value is string => Boolean(value))
    .filter((value, index, values) => !values.some((other, otherIndex) => otherIndex !== index && other.includes(value) && (other !== value || otherIndex < index)))
  const specification = specifications.join('、')
  termsByLabel.set(alias.sourceLabel, { name, ...(specification ? { specification } : {}) })
}
// Canonical family names are idempotent, including names introduced by this vocabulary.
for (const family of MATERIAL_FAMILIES) termsByLabel.set(family.name, { name: family.name })

export function resolveMaterialTerm(label: string): MaterialTerm | undefined {
  const term = termsByLabel.get(label.trim())
  return term ? { ...term } : undefined
}

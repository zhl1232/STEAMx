import materialCatalog from './household-materials.data.json'
import { getMaterialGroupId, MATERIAL_GROUPS_BY_ID } from './material-groups'
export { HOUSEHOLD_MATERIAL_GROUPS, getMaterialGroupId, getMaterialSelectionCount } from './material-groups'

type HouseholdMaterial = {
  id: string
  label: string
  common?: boolean
  description?: string
  category?: string
  aliases?: string[]
}

// Explicitly reviewed identities only. Color/quantity requirements stay in the
// project checklist; functional specifications remain distinct catalog entries.
const catalog: readonly (HouseholdMaterial & { canonicalId?: string })[] = materialCatalog
const canonicalIds = new Map(catalog.map(({ id, canonicalId }) => [id, canonicalId ?? id]))
const catalogById = new Map(catalog.map((material) => [material.id, material]))
const materialsById = new Map<string, HouseholdMaterial>()
for (const material of catalog) {
  const id = canonicalIds.get(material.id)!
  const canonical = catalogById.get(id)!
  const merged = materialsById.get(id) ?? { ...canonical, aliases: [] }
  if (material.label !== canonical.label) merged.aliases!.push(material.label)
  materialsById.set(id, merged)
}

/** Lightweight catalog shared with the picker; project profiles stay on the server. */
export const HOUSEHOLD_MATERIALS: readonly HouseholdMaterial[] = [...materialsById.values()]

export type MaterialMatch = {
  requiredCount: number
  ownedCount: number
  missingLabels: string[]
  hasSelection: boolean
  pendingLabels?: string[]
}

// Only reviewed source rows are accepted. Do not remove specifications or infer
// substitutes: an unfamiliar required row must leave the match unconfirmed.
const SOURCE_MATERIAL_IDS = new Map<string, string>([
  ['纸杯', 'paper-cup'],
  ['橡皮泥', 'clay'],
  ['贴纸', 'stickers'],
  ['毛线', 'yarn'],
  ['针', 'needle'],
  ['剪刀', 'scissors'],
  ['纸巾1张', 'tissue'],
  ['水溶性水彩笔数色', 'watercolor'],
  ['浅盘1个', 'tray'],
  ['清水', 'water'],
  ['气球1个', 'balloon'],
  ['直吸管1根', 'straw'],
  ['细绳', 'string'],
  ['双面胶', 'tape'],
  ['剪刀（成人使用）', 'scissors'],
  ['带盖透明塑料瓶1个', 'bottle'],
  ['少量牛奶', 'milk'],
  ['手机手电筒（成人保管）', 'flashlight'],
  ['擦水布', 'cloth'],
  ['A4纸1张', 'paper'],
  ['白纸1张', 'paper'],
  ['正方形纸1张（可由A4纸裁成）', 'paper'],
  ['剪刀（成人协助）', 'scissors'],
  ['同样大小的干燥纸杯2个', 'paper-cup'],
  ['个人使用的吸管1根', 'straw'],
  ['透明塑料瓶1个', 'bottle'],
  ['吸管1根', 'straw'],
  ['纸杯2个', 'paper-cup'],
  ['细棉线1根', 'cotton-thread'],
])
const OPTIONAL_SOURCE_ROWS = new Set(['打气筒（建议使用）'])
// A place to tie the string is a setup condition, not a material to own.
const PREPARATION_SOURCE_ROWS = new Map([
  ['两处稳固的绳端固定点', '请成人把细绳两端系在两个稳固的位置，例如两把稳固椅子的椅背上。确认系牢，再把绳子拉直、保持接近水平。'],
])

/** Keep setup instructions separate from the material checklist. */
export function splitMaterialPreparation(sourceRows: readonly string[]): { materials: string[]; preparationNotes: string[] } {
  const materials: string[] = []
  const preparationNotes = new Set<string>()
  for (const source of sourceRows) {
    const note = PREPARATION_SOURCE_ROWS.get(source)
    if (note) preparationNotes.add(note)
    else materials.push(source)
  }
  return { materials, preparationNotes: [...preparationNotes] }
}

/** Validate a parsed storage value and restore catalog order. */
export function normalizeOwnedMaterialIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const selected = new Set(value.filter((id): id is string => typeof id === 'string').map((id) => id.startsWith('group:') ? getMaterialGroupId(id) : canonicalIds.get(id)))
  return [
    ...HOUSEHOLD_MATERIALS.filter(({ id }) => selected.has(id)).map(({ id }) => id),
    ...[...MATERIAL_GROUPS_BY_ID.keys()].filter((id) => selected.has(id)),
  ]
}

const MATERIAL_ORDER = new Map(HOUSEHOLD_MATERIALS.map(({ id }, index) => [id, index]))

/** Explicit profiles fail closed instead of falling back to legacy source-row aliases. */
export function validateMaterialRequirements(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const unique = new Map<string, string[]>()
  for (const group of value) {
    if (!Array.isArray(group) || group.length === 0) return null
    if (group.some((id) => typeof id !== 'string' || !canonicalIds.has(id))) return null
    const ids = [...new Set((group as string[]).map((id) => canonicalIds.get(id)!))].sort((left, right) => MATERIAL_ORDER.get(left)! - MATERIAL_ORDER.get(right)!)
    unique.set(ids.join('\0'), ids)
  }
  const groups = [...unique.values()]
  // Satisfying a subset clause also satisfies every clause containing its alternatives.
  return groups.filter((group) => !groups.some((other) => other.length < group.length && other.every((id) => group.includes(id))))
}

function compareMaterialSets(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const order = MATERIAL_ORDER.get(left[index])! - MATERIAL_ORDER.get(right[index])!
    if (order) return order
  }
  return left.length - right.length
}

type MaterialAvailability = 0 | 1 | 2 // confirmed, specification pending, missing

function materialAvailability(owned: ReadonlySet<string>): (id: string) => MaterialAvailability {
  const families = new Set([...owned].map(getMaterialGroupId))
  return (id) => {
    if (owned.has(id)) return 0
    const groupId = getMaterialGroupId(id)!
    const group = MATERIAL_GROUPS_BY_ID.get(groupId)!
    if (!families.has(groupId)) return 2
    // A checked specific member also establishes ownership of its generic family.
    return group.baseId === id ? 0 : 1
  }
}

function selectionScore(ids: readonly string[], availability: (id: string) => MaterialAvailability): number[] {
  const families = new Map<string, MaterialAvailability>()
  for (const id of ids) {
    const groupId = getMaterialGroupId(id)!
    families.set(groupId, Math.max(families.get(groupId) ?? 0, availability(id)) as MaterialAvailability)
  }
  const states = [...families.values()]
  return [states.filter((state) => state === 2).length, states.filter((state) => state === 1).length, families.size, ids.length]
}

function compareScores(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return left[index] - right[index]
  return 0
}

/** Exact AND/OR hitting set; category ownership never erases specific clauses. */
function chooseRequiredMaterials(groups: string[][], owned: ReadonlySet<string>): string[] {
  const availability = materialAvailability(owned)
  // Shared families also connect components: their counting and pending state interact.
  const parent = groups.map((_, index) => index)
  function root(index: number): number {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index] }
    return index
  }
  const firstGroup = new Map<string, number>()
  groups.forEach((group, index) => group.forEach((id) => {
    const family = getMaterialGroupId(id)!
    const previous = firstGroup.get(family)
    if (previous === undefined) firstGroup.set(family, index)
    else parent[root(index)] = root(previous)
  }))
  const components = new Map<number, string[][]>()
  groups.forEach((group, index) => {
    const key = root(index)
    const component = components.get(key) ?? []
    component.push(group)
    components.set(key, component)
  })
  const required: string[] = []
  for (const component of components.values()) {
    let best: string[] | null = null
    let bestScore: number[] | null = null
    const selected = new Set<string>()
    const seen = new Set<string>()
    function search() {
      const ids = [...selected].sort((a, b) => MATERIAL_ORDER.get(a)! - MATERIAL_ORDER.get(b)!)
      const key = ids.join('\0')
      if (seen.has(key)) return
      seen.add(key)
      const score = selectionScore(ids, availability)
      if (bestScore && compareScores(score, bestScore) > 0) return
      const uncovered = component.filter((group) => !group.some((id) => selected.has(id)))
      if (uncovered.length === 0) {
        if (!bestScore || compareScores(score, bestScore) < 0 || (compareScores(score, bestScore) === 0 && compareMaterialSets(ids, best!) < 0)) {
          best = ids
          bestScore = score
        }
        return
      }
      const next = uncovered.reduce((left, right) => left.length <= right.length ? left : right)
      for (const id of [...next].sort((a, b) => availability(a) - availability(b) || MATERIAL_ORDER.get(a)! - MATERIAL_ORDER.get(b)!)) {
        selected.add(id)
        search()
        selected.delete(id)
      }
    }
    search()
    required.push(...(best ?? []))
  }
  return required.sort((a, b) => MATERIAL_ORDER.get(a)! - MATERIAL_ORDER.get(b)!)
}

function describeMaterialMatch(required: readonly string[], owned: ReadonlySet<string>): MaterialMatch {
  const availability = materialAvailability(owned)
  const families = new Map<string, { state: MaterialAvailability; label: string }>()
  for (const id of required) {
    const groupId = getMaterialGroupId(id)!
    const previous = families.get(groupId)
    const group = MATERIAL_GROUPS_BY_ID.get(groupId)!
    families.set(groupId, {
      state: Math.max(previous?.state ?? 0, availability(id)) as MaterialAvailability,
      label: group.label,
    })
  }
  const missingLabels = [...families.values()].filter(({ state }) => state === 2).map(({ label }) => label)
  const pendingLabels = [...families.values()].filter(({ state }) => state === 1).map(({ label }) => label)
  return {
    requiredCount: families.size,
    ownedCount: families.size - missingLabels.length,
    missingLabels,
    hasSelection: owned.size > 0,
    ...(pendingLabels.length ? { pendingLabels } : {}),
  }
}

export function matchProjectMaterials(
  materials: readonly string[] | null | undefined,
  ownedIds: readonly string[],
  requirements?: readonly (readonly string[])[],
): MaterialMatch | null {
  if (requirements !== undefined) {
    const groups = validateMaterialRequirements(requirements)
    if (!groups) return null
    const owned = new Set(normalizeOwnedMaterialIds(ownedIds))
    const required = chooseRequiredMaterials(groups, owned)
    return describeMaterialMatch(required, owned)
  }
  if (!Array.isArray(materials) || materials.length === 0) return null

  const required = new Set<string>()
  for (const source of materials) {
    if (OPTIONAL_SOURCE_ROWS.has(source) || PREPARATION_SOURCE_ROWS.has(source)) continue
    const id = SOURCE_MATERIAL_IDS.get(source)
    if (!id) return null
    required.add(id)
  }
  if (required.size === 0) return null

  const owned = new Set(normalizeOwnedMaterialIds(ownedIds))
  return describeMaterialMatch([...required], owned)
}

export function sortProjectsByMaterials<T extends { materials?: string[]; householdRequirements?: string[][] }>(
  projects: readonly T[],
  ownedIds: readonly string[],
): T[] {
  return projects
    .map((project, index) => ({ project, index, match: matchProjectMaterials(project.materials, ownedIds, project.householdRequirements) }))
    .sort((a, b) => {
      if (!a.match || !b.match) {
        if (a.match) return -1
        if (b.match) return 1
        return a.index - b.index
      }
      if (a.match.hasSelection) {
        const missingOrder = a.match.missingLabels.length - b.match.missingLabels.length
        if (missingOrder) return missingOrder
        const pendingOrder = (a.match.pendingLabels?.length ?? 0) - (b.match.pendingLabels?.length ?? 0)
        if (pendingOrder) return pendingOrder
        const ownedOrder = b.match.ownedCount - a.match.ownedCount
        if (ownedOrder) return ownedOrder
      }
      return a.match.requiredCount - b.match.requiredCount || a.index - b.index
    })
    .map(({ project }) => project)
}

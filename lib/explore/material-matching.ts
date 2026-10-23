import materialCatalog from './household-materials.data.json'

/** Lightweight catalog shared with the picker; project profiles stay on the server. */
export const HOUSEHOLD_MATERIALS: readonly {
  id: string
  label: string
  common?: boolean
  description?: string
  category?: string
}[] = materialCatalog

export type MaterialMatch = {
  requiredCount: number
  ownedCount: number
  missingLabels: string[]
  hasSelection: boolean
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
const MATERIAL_LABELS = new Map(HOUSEHOLD_MATERIALS.map(({ id, label }) => [id, label]))

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
  const selected = new Set(value.filter((id): id is string => typeof id === 'string'))
  return HOUSEHOLD_MATERIALS.filter(({ id }) => selected.has(id)).map(({ id }) => id)
}

const MATERIAL_ORDER = new Map(HOUSEHOLD_MATERIALS.map(({ id }, index) => [id, index]))

/** Explicit profiles fail closed instead of falling back to legacy source-row aliases. */
export function validateMaterialRequirements(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const unique = new Map<string, string[]>()
  for (const group of value) {
    if (!Array.isArray(group) || group.length === 0) return null
    if (group.some((id) => typeof id !== 'string' || !MATERIAL_ORDER.has(id))) return null
    const ids = [...new Set(group as string[])].sort((left, right) => MATERIAL_ORDER.get(left)! - MATERIAL_ORDER.get(right)!)
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

/** Exact minimum hitting set, split into independent components of shared alternatives. */
function chooseRequiredMaterials(groups: string[][], owned: ReadonlySet<string>): string[] {
  const parent = groups.map((_, index) => index)
  function root(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const firstGroup = new Map<string, number>()
  groups.forEach((group, index) => group.forEach((id) => {
    const previous = firstGroup.get(id)
    if (previous === undefined) firstGroup.set(id, index)
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
    const coverage = new Map<string, number[]>()
    component.forEach((group, index) => group.forEach((id) => {
      const indices = coverage.get(id) ?? []
      indices.push(index)
      coverage.set(id, indices)
    }))
    let best: string[] | null = null
    let bestMissing = Infinity
    const selected = new Set<string>()
    const covered = component.map(() => false)
    const seen = new Map<string, { missing: number; ids: string[] }>()
    function search(remaining: number, missing: number) {
      if (missing > bestMissing || (missing === bestMissing && best !== null && selected.size > best.length)) return
      const ids = [...selected].sort((left, right) => MATERIAL_ORDER.get(left)! - MATERIAL_ORDER.get(right)!)
      if (remaining === 0) {
        if (missing < bestMissing || best === null || ids.length < best.length || (ids.length === best.length && compareMaterialSets(ids, best) < 0)) {
          best = ids
          bestMissing = missing
        }
        return
      }
      const key = covered.map((value) => value ? '1' : '0').join('')
      const prior = seen.get(key)
      if (prior && (prior.missing < missing || (prior.missing === missing && (prior.ids.length < ids.length || (prior.ids.length === ids.length && compareMaterialSets(prior.ids, ids) <= 0))))) return
      seen.set(key, { missing, ids })
      // Branch on the tightest uncovered clause; prefer existing materials, then catalog order.
      let next = -1
      for (let index = 0; index < component.length; index++) {
        if (!covered[index] && (next < 0 || component[index].length < component[next].length)) next = index
      }
      const alternatives = [...component[next]].sort((left, right) => Number(owned.has(right)) - Number(owned.has(left)) || MATERIAL_ORDER.get(left)! - MATERIAL_ORDER.get(right)!)
      for (const id of alternatives) {
        selected.add(id)
        const changed = coverage.get(id)!.filter((index) => !covered[index])
        for (const index of changed) covered[index] = true
        search(remaining - changed.length, missing + (owned.has(id) ? 0 : 1))
        for (const index of changed) covered[index] = false
        selected.delete(id)
      }
    }
    search(component.length, 0)
    required.push(...(best ?? []))
  }
  return required.sort((left, right) => MATERIAL_ORDER.get(left)! - MATERIAL_ORDER.get(right)!)
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
    const missing = required.filter((id) => !owned.has(id))
    return {
      requiredCount: required.length,
      ownedCount: required.length - missing.length,
      missingLabels: missing.map((id) => MATERIAL_LABELS.get(id)!),
      hasSelection: owned.size > 0,
    }
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
  const missing = [...required].filter((id) => !owned.has(id))
  return {
    requiredCount: required.size,
    ownedCount: required.size - missing.length,
    missingLabels: missing.map((id) => MATERIAL_LABELS.get(id)!),
    hasSelection: owned.size > 0,
  }
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
        const ownedOrder = b.match.ownedCount - a.match.ownedCount
        if (ownedOrder) return ownedOrder
      }
      return a.match.requiredCount - b.match.requiredCount || a.index - b.index
    })
    .map(({ project }) => project)
}

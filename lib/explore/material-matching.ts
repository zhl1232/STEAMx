/** Selectable material types for household-material matching. */
export const HOUSEHOLD_MATERIALS: readonly {
  id: string
  label: string
  common?: boolean
  description?: string
}[] = [
  { id: 'tissue', label: '纸巾', common: true },
  { id: 'balloon', label: '气球', common: true },
  { id: 'straw', label: '直吸管', common: true },
  { id: 'water', label: '清水', common: true },
  { id: 'paper-cup', label: '纸杯', common: true },
  { id: 'watercolor', label: '水溶性彩笔', common: true },
  { id: 'flashlight', label: '手机手电筒', common: true },
  { id: 'tray', label: '浅盘' },
  { id: 'clay', label: '橡皮泥' },
  { id: 'stickers', label: '贴纸' },
  { id: 'yarn', label: '毛线' },
  { id: 'needle', label: '针' },
  { id: 'scissors', label: '剪刀' },
  { id: 'string', label: '细绳' },
  { id: 'tape', label: '双面胶' },
  { id: 'bottle', label: '带盖透明瓶', description: '透明塑料材质' },
  { id: 'milk', label: '牛奶' },
  { id: 'cloth', label: '擦水布' },
  { id: 'paper', label: 'A4白纸' },
  { id: 'cotton-thread', label: '细棉线' },
]

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

export function matchProjectMaterials(
  materials: readonly string[] | null | undefined,
  ownedIds: readonly string[],
): MaterialMatch | null {
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

export function sortProjectsByMaterials<T extends { materials?: string[] }>(
  projects: readonly T[],
  ownedIds: readonly string[],
): T[] {
  return projects
    .map((project, index) => ({ project, index, match: matchProjectMaterials(project.materials, ownedIds) }))
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

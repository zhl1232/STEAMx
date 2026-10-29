import materialCatalog from '../explore/household-materials.data.json'
import { getMaterialMeta } from './material-meta'
import presentationRules from './material-presentation.data.json'

/** Presentation-only cleanup. Source instructions and their content hashes stay intact. */
const REVIEWED_SPLITS = new Map(presentationRules.splitRows.map(({ source, materials }) => [source, materials]))
const REVIEWED_PREPARATION = new Map(presentationRules.preparationRows.map(({ source, note }) => [source, note]))

const MATERIAL_NAMES = new Set([
  ...materialCatalog.flatMap(({ label }) => [label, getMaterialMeta(label).name]),
  '盘子', '碗', '盆', '纸', '冷水', '热水', '瓶子', '铅笔', '调色盘',
])

function isIndependentMaterial(value: string): boolean {
  const meta = getMaterialMeta(value)
  return MATERIAL_NAMES.has(meta.name) || MATERIAL_NAMES.has(canonicalName(meta.name))
}

function splitMaterialList(value: string, delimiters: ReadonlySet<string>): string[] {
  const parts = splitTopLevel(value, delimiters)
  // Alternatives and shared qualifiers must keep their original scope.
  if (parts.length < 2 || /或|三选|二选|任选|可选|另备|分别|两种|两色|各色/.test(value)) return [value]
  if (/[（(]/.test(parts[parts.length - 1])) return [value]
  return parts.every(isIndependentMaterial) ? parts : [value]
}

/** Delimit only outside parentheses, retaining color lists and nested specs. */
function splitTopLevel(value: string, delimiters: ReadonlySet<string>): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (char === '（' || char === '(') depth++
    else if (char === '）' || char === ')') depth--
    else if (depth === 0 && delimiters.has(char)) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  // Imported malformed parentheses remain visible rather than losing context.
  if (depth !== 0) return [value]
  parts.push(value.slice(start).trim())
  return parts.every(Boolean) ? parts : [value]
}

function canonicalName(value: string): string {
  const meta = getMaterialMeta(value)
  const alternatives = splitTopLevel(meta.name, new Set(['或', '/']))
  const parts = alternatives.map(getMaterialMeta)
  // Normalize complete known alternatives without turning OR into multiple
  // required rows or moving a shared quantity onto only the last branch.
  const canNormalizeAlternatives = parts.length > 1 && parts.every((part) =>
    MATERIAL_NAMES.has(part.name) && !part.amount && !/可选|任选|三选|二选|分别|同时|均|成人/.test(part.note ?? ''))
  const name = canNormalizeAlternatives
    ? parts.map((part) => `${part.name}${part.note ? `（${part.note}）` : ''}`).join('或')
    : meta.name
  return `${name}${meta.amount}${meta.note ? `（${meta.note}）` : ''}`
}

// Reviewed presentation rewrites, guarded by both the complete note and its
// supporting material rows. Changed source requirements must remain visible.
const PREPARATION_REWRITES = [
  {
    note: '水500毫升、洗洁精3勺、甘油或白糖1勺；以原文勺量保留，不换算为克。',
    requires: ['水 500毫升', '洗洁精 3勺', '甘油或白糖 1勺'],
    replacement: '按勺量取，不换算为克。',
  },
  {
    note: '准备多张画布板或厚卡纸；配色需能包含步骤中的黄、橙、亮粉、蓝、绿等暖冷色。',
    requires: ['画布板或厚卡纸（多张）', '丙烯颜料或水粉颜料（备黄、橙、亮粉、蓝、绿等步骤使用的颜色）'],
    replacement: '配色需包含暖色和冷色。',
  },
  {
    note: '清水约150毫升、食用油15毫升和3种色素。',
    requires: ['清水约150毫升', '色素', '自备（盘子、塑料瓶、食用油）'],
    replacement: '',
    rows: { 色素: '色素（3种颜色）', '自备（盘子、塑料瓶、食用油）': '自备（盘子、塑料瓶、食用油15毫升）' },
  },
] satisfies { note: string; requires: string[]; replacement: string; rows?: Record<string, string> }[]

export function normalizeMaterialPresentation(
  sourceRows: readonly string[],
  existingNotes: readonly string[] = [],
): { materials: string[]; preparationNotes: string[] } {
  const materials: string[] = []
  const notes = new Set(existingNotes.map((note) => note.trim()).filter(Boolean))
  let reviewedRows = [...sourceRows]
  for (const rule of PREPARATION_REWRITES) {
    if (!notes.has(rule.note) || !rule.requires.every((row) => sourceRows.includes(row))) continue
    notes.delete(rule.note)
    if (rule.replacement) notes.add(rule.replacement)
    const replacements: Record<string, string> | undefined = rule.rows
    if (replacements) reviewedRows = reviewedRows.map((row) => replacements[row] ?? row)
  }
  const rows: string[] = []
  for (const source of reviewedRows) {
    const row = source.trim()
    if (!row) continue
    const supplied = row.match(/^自备\s*[（(]([\s\S]*)[）)]$/)
    const content = supplied?.[1] ?? row
    const reviewed = REVIEWED_SPLITS.get(row) ?? REVIEWED_SPLITS.get(content)
    rows.push(...(reviewed ?? splitMaterialList(content, new Set(['、', '；', ';']))))
  }

  for (const row of rows) {
    const preparation = REVIEWED_PREPARATION.get(row)
    if (preparation) { notes.add(preparation); continue }
    if (/^阳光[（(].*[）)]$/.test(row)) {
      notes.add(row.replace(/^阳光[（(](.*)[）)]$/, '环境要求：阳光，$1。'))
      continue
    }
    const measuring = row.match(/^量取(.+)所需(直尺|卷尺|量杯|量具)$/)
    if (measuring) {
      materials.push(measuring[2])
      notes.add(`${measuring[2]}：量取${measuring[1]}。`)
      continue
    }
    const measurementTool = row.match(/^量取(.+)的(量具)$/)
    if (measurementTool) {
      materials.push(measurementTool[2])
      notes.add(`${measurementTool[2]}：量取${measurementTool[1]}。`)
      continue
    }

    const parsed = row.match(/^(.*?)[（(]([^（）()]+)[）)]$/)
    const base = parsed?.[1].trim() ?? row
    const note = parsed?.[2].trim()
    const conjunction = base.split('和')
    const canSplit = conjunction.length > 1 && conjunction.every(isIndependentMaterial)
      && !note?.match(/可选|另备|分别|或/)
    const names = canSplit ? conjunction : [base]
    for (const name of names) {
      const normalized = name
      if (note && (/^(?:成人|需家长|需成人|选择晴天)/.test(note) || (note.split(/[；;]/)[0].length >= 12 && /^(?:用|做|画|记录|标注|量取|接|稀释|组装)/.test(note)))) {
        notes.add(`${names.map(canonicalName).join('、')}：${note.replace(/[。；]$/, '')}。`)
        materials.push(normalized)
      } else {
        materials.push(note ? `${normalized}（${note}）` : normalized)
      }
    }
  }

  // Same material with explicit color variants becomes one row, retaining every
  // color. Never merge different kinds of clay, paint, or soluble/food pigments.
  const colors = new Map<string, { index: number; values: string[] }>()
  const merged: string[] = []
  for (const row of materials) {
    const colored = row.match(/^((?:红|蓝|黄|绿|橙|紫|黑|白|粉|棕)色)(黏土|橡皮泥|超轻黏土|彩纸|卡纸)$/)
    if (!colored) { merged.push(row); continue }
    const [, color, name] = colored
    const prior = colors.get(name)
    if (prior) {
      if (!prior.values.includes(color)) prior.values.push(color)
      merged[prior.index] = `${name}（${prior.values.join('、')}）`
    } else {
      colors.set(name, { index: merged.length, values: [color] })
      merged.push(row)
    }
  }
  return { materials: [...new Set(merged.flatMap((row) => REVIEWED_SPLITS.get(row) ?? [row]).map(canonicalName))], preparationNotes: [...notes] }
}

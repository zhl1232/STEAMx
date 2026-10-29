import { resolveMaterialTerm } from '@/lib/explore/material-taxonomy'

const NUMBER = '(?:\\d+(?:\\.\\d+)?|[一二两三四五六七八九十百半]+)'
const RANGE = `${NUMBER}(?:\\s*[-–—～~至]\\s*${NUMBER})?`
const UNIT = '(?:毫升|ml|厘米|cm|毫米|mm|千克|kg|克|g|米|个|只|张|根|支|套|瓶|块|枚|片|条|卷|把|本|颗|粒|勺|杯|滴|盆|面|段|对|组|包|盒|袋|圈|种|色)'
const QUANTITY = `(?:(?:(?:约|至少|最多|大约)\\s*)?${RANGE}\\s*${UNIT}(?:左右|以上|以下)?|(?:若干${UNIT}?|(?:数|多)${UNIT})|适量|少量|少许)`
const TRAILING_AMOUNT = new RegExp(`(${QUANTITY})$`, 'i')
const LEADING_AMOUNT = new RegExp(`^(${QUANTITY})(?=\\S)`, 'i')
const WHOLE_AMOUNT = new RegExp(`^${QUANTITY}$`, 'i')
const DIMENSIONS = /\d(?:\s*(?:毫米|厘米|cm|mm|米))?\s*[×*]\s*\d/i
const COMPOUND = /[、，,；;]|(?:和|及|与|或|\/)/
const CAPACITY_CONTAINER = /(?:瓶|杯|碗|盒|罐|桶|盆)$/
const DIMENSIONED_OBJECT = /(?:尺|纸|纸板|木板|板|片)$/
const DIMENSION_ROW = new RegExp(`^(.+?)\\s*(\\d+(?:\\.\\d+)?(?:\\s*(?:毫米|厘米|mm|cm|米))?(?:\\s*[×*]\\s*\\d+(?:\\.\\d+)?(?:\\s*(?:毫米|厘米|mm|cm|米))?){1,2})(?:\\s*(${QUANTITY}))?$`, 'i')

export type MaterialMeta = {
  name: string
  amount: string
  note?: string
}

/** Only peel a complete final parenthesized note; malformed input stays intact. */
function splitNote(value: string): { base: string; note?: string } {
  if (!/[）)]$/.test(value)) return { base: value }
  let depth = 0
  for (let index = value.length - 1; index >= 0; index--) {
    if (value[index] === '）' || value[index] === ')') depth++
    else if (value[index] === '（' || value[index] === '(') {
      depth--
      if (depth === 0 && index > 0) return { base: value.slice(0, index).trim(), note: value.slice(index + 1, -1).trim() }
    }
  }
  return { base: value }
}

function joinNotes(...values: (string | undefined)[]): string | undefined {
  const notes = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
  return notes.length ? notes.join('；') : undefined
}

function namedMaterial(base: string, amount: string, note?: string): MaterialMeta {
  let term = resolveMaterialTerm(base)
  // These modifiers describe the state of an otherwise exactly identified
  // material. Do not strip arbitrary adjectives or guess an unknown noun.
  const old = !term ? base.match(/^旧的(.+)$/) : null
  if (old) {
    const identity = resolveMaterialTerm(old[1])
    if (identity) {
      const specification = identity.specification ?? old[1]
      const detail = specification.endsWith(identity.name) && specification !== identity.name
        ? specification.slice(0, -identity.name.length) : specification
      term = { name: identity.name, specification: `旧的${detail}` }
    }
  }
  if (!term && /^(?:常温|室温)(?:清水|自来水|水)$/.test(base)) {
    const water = resolveMaterialTerm('水')
    if (water) term = { name: water.name, specification: base }
  }
  const combined = joinNotes(term?.specification, note)
  return { name: term?.name ?? base, amount, ...(combined ? { note: combined } : {}) }
}

/** Shared names come from the same reviewed vocabulary as the household picker. */
export function getMaterialMeta(material: string): MaterialMeta {
  const normalized = material.trim()
  const color = normalized.match(/^((?:红|蓝|黄|绿|橙|紫|黑|白|粉|棕)色)(黏土|橡皮泥|超轻黏土|彩纸|卡纸)$/)
  if (color && resolveMaterialTerm(color[2])) return namedMaterial(color[2], '', color[1])
  // Exact identities such as 2B铅笔, 1角硬币, and dimensional labels take
  // precedence over quantities embedded in their spelling.
  const exact = resolveMaterialTerm(normalized)
  if (exact) {
    const source = splitNote(normalized)
    const specification = exact.specification === normalized && source.base === exact.name ? source.note : exact.specification
    return { name: exact.name, amount: '', ...(specification ? { note: specification } : {}) }
  }

  const { base: baseRaw, note } = splitNote(normalized)
  if (baseRaw === '自备' && note) return { name: `自备：${note}`, amount: '', note }
  const dimension = baseRaw.match(DIMENSION_ROW)
  if (dimension && resolveMaterialTerm(dimension[1].trim())) {
    return namedMaterial(dimension[1].trim(), dimension[3]?.trim() ?? '', joinNotes(dimension[2], note))
  }
  // A compound expression has shared scope. Its counts and alternatives cannot
  // safely be attributed to a single material, so retain the complete text.
  if (COMPOUND.test(baseRaw) || DIMENSIONS.test(baseRaw)) return { name: baseRaw, amount: '', ...(note ? { note } : {}) }

  let base = baseRaw
  let amount = ''
  const trailing = baseRaw.match(TRAILING_AMOUNT)
  const leading = !trailing ? baseRaw.match(LEADING_AMOUNT) : null
  const amountMatch = trailing ?? leading
  if (amountMatch) {
    const candidate = trailing ? baseRaw.slice(0, amountMatch.index).trim() : baseRaw.slice(amountMatch[0].length).trim()
    if (candidate) {
      base = candidate
      amount = amountMatch[1].replace(/\s+/g, '').trim()
    }
  }

  let retainedNote = note
  const capacity = base.match(TRAILING_AMOUNT)
  if (capacity && capacity.index !== undefined) {
    const container = base.slice(0, capacity.index).trim()
    if (CAPACITY_CONTAINER.test(container) && /(?:毫升|ml)$/i.test(capacity[1])) {
      base = container
      retainedNote = joinNotes(capacity[1], retainedNote)
    }
  }
  if (!amount && note && WHOLE_AMOUNT.test(note) && !/(?:厘米|cm|毫米|mm|米|毫升|ml|克|g)$/i.test(note)) {
    amount = note
    retainedNote = undefined
  }
  // Capacity and dimensions describe an object rather than how many objects
  // are needed. Keep them attached to the material's specification.
  if (amount && ((CAPACITY_CONTAINER.test(base) && /(?:毫升|ml)$/i.test(amount))
    || (DIMENSIONED_OBJECT.test(base) && /(?:厘米|cm|毫米|mm|米)$/i.test(amount)))) {
    retainedNote = joinNotes(amount, retainedNote)
    amount = ''
  }
  return namedMaterial(base, amount, retainedNote)
}

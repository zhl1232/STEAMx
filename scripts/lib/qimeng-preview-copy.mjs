/**
 * Shared 启蒙版 copy cleanup + content.txt parser.
 * Strips preview-batch chrome and WeChat CTAs; keeps 启蒙版 + qimeng-src:*.
 */

export const TAG_SOURCE = '启蒙版'
export const TAG_PREVIEW = '预览'
export const TITLE_PREFIX = '【预览】'
export const FALLBACK_MATERIAL = '（见实验说明）'
export const FALLBACK_STEP = {
  title: '步骤 1',
  description: '请按材料准备后动手尝试。',
  sort_order: 0,
}

const DESC_BANNER_RE = /^【启蒙版[·・]?预览】\s*$/u
const DESC_BANNER_INLINE_RE = /【启蒙版[·・]?预览】/gu
const VIDEO_LINE_RE =
  /^(?:演示视频(?:（外链）)?|【演示视频】)\s*[:：]?\s*(?:https:\/\/\S+\.mp4)?\s*$/u
const VIDEO_MISSING_RE = /^演示视频：本次预览未挂载.*$/u
const BARE_MP4_LINE_RE = /^https:\/\/\S+\.mp4\s*$/i
const SOURCE_LINE_RE = /^来源：伙伴启蒙版实验.*/u
const PREVIEW_ENTRY_RE = /启蒙版合作实验预览条目/
const VIDEO_INLINE_PREFIX_RE = /^【演示视频】\s*https:\/\/\S+\.mp4\s*/u
const EMPTY_STEPS_RE = /（预览条目步骤解析为空）/g
const PREVIEW_IMPORT_RE = /伙伴启蒙版实验预览导入[；;]?\s*/u
/** WeChat article CTA and close variants (蓝字 / 蓝色字体 / trailing punct). */
const WECHAT_CTA_RE = /请?点击上方?蓝(?:色字体|字)关注我们[！!。．…]*|点击蓝色字体关注我们[！!。．…]*/g
const SECTION_HEADER_RE =
  /^(实验材料|实验步骤\d*|科学原理\d*|原理分析)\s*[：:∶]?\s*(.*)$/u
const IGNORE_SECTION_RE = /^(生活百科|科学导入)/u
const QIMENG_SRC_RE = /^qimeng-src:(.+)$/i

export function isQimengSourceTag(tag) {
  return QIMENG_SRC_RE.test(String(tag || '').trim())
}

export function qimengSourceIdFromTags(tags) {
  for (const tag of tags || []) {
    const match = String(tag || '').trim().match(QIMENG_SRC_RE)
    if (match) return match[1]
  }
  return null
}

function collapseBlankLines(text) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function stripQimengWeChatCta(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(WECHAT_CTA_RE, '')
}

function isVideoUrlLine(trimmed) {
  if (!trimmed) return false
  if (VIDEO_LINE_RE.test(trimmed) || VIDEO_MISSING_RE.test(trimmed) || BARE_MP4_LINE_RE.test(trimmed)) {
    return true
  }
  return /https:\/\/\S+\.mp4/i.test(trimmed) && /演示视频/.test(trimmed)
}

export function cleanQimengTitle(title) {
  return String(title || '').replace(/^【预览】/, '').trim()
}

export function cleanQimengDescription(description) {
  const raw = stripQimengWeChatCta(description).trim()
  if (!raw) return ''

  const kept = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push('')
      continue
    }
    if (DESC_BANNER_RE.test(trimmed)) continue
    if (isVideoUrlLine(trimmed)) continue
    if (SOURCE_LINE_RE.test(trimmed)) continue
    if (PREVIEW_ENTRY_RE.test(trimmed)) continue
    kept.push(line.trimEnd())
  }

  return collapseBlankLines(kept.join('\n').replace(DESC_BANNER_INLINE_RE, ''))
}

export function cleanQimengStepDescription(description) {
  let text = stripQimengWeChatCta(description).trim()
  if (!text) return ''

  text = text.replace(VIDEO_INLINE_PREFIX_RE, '')
  text = text.replace(EMPTY_STEPS_RE, '')
  text = text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      return !isVideoUrlLine(trimmed)
    })
    .join('\n')

  return collapseBlankLines(text)
}

export function cleanQimengReflection(reflection) {
  let text = stripQimengWeChatCta(reflection).trim()
  if (!text) return ''
  text = text.replace(/^【启蒙版[·・]?预览】\s*/u, '')
  text = text.replace(/^科学原理补充[：:]\s*/u, '')
  return collapseBlankLines(text)
}

export function cleanQimengProblemStatement(text) {
  let next = String(text || '').replace(/\r\n/g, '\n').trim()
  next = next.replace(/^【启蒙版[·・]?预览】\s*/u, '')
  next = next.replace(PREVIEW_IMPORT_RE, '')
  return next.trim()
}

export function cleanQimengTags(tags) {
  const seen = new Set()
  const result = []
  for (const tag of tags || []) {
    const value = String(tag || '').trim()
    if (!value || value === TAG_PREVIEW) continue
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function normalizeQimengCopyForCompare(text) {
  return String(text || '')
    .replace(/【启蒙版[·・]?预览】/gu, '')
    .replace(/【预览】/gu, '')
    .replace(/科学原理补充[：:]/gu, '')
    .replace(/科学原理[：:]/gu, '')
    .replace(/\s+/g, '')
    .trim()
}

export function isDuplicateQimengReflection(reflection, description) {
  const normalizedReflection = normalizeQimengCopyForCompare(reflection)
  if (!normalizedReflection) return true
  const normalizedDescription = normalizeQimengCopyForCompare(description)
  return Boolean(normalizedDescription) && normalizedReflection === normalizedDescription
}

export function applyQimengPreviewCopyCleanup({
  title,
  description,
  reflection,
  tags,
  problem_statement,
} = {}) {
  const nextTitle = cleanQimengTitle(title)
  const nextDescription = cleanQimengDescription(description)
  let nextReflection = cleanQimengReflection(reflection)
  if (isDuplicateQimengReflection(nextReflection, nextDescription)) nextReflection = ''
  return {
    title: nextTitle,
    description: nextDescription,
    reflection: nextReflection,
    tags: cleanQimengTags(tags),
    problem_statement: cleanQimengProblemStatement(problem_statement),
  }
}

export function sameStringArray(left, right) {
  const a = left || []
  const b = right || []
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function classifySectionHeader(name) {
  if (name.startsWith('实验材料')) return 'materials'
  if (name.startsWith('实验步骤')) return 'steps'
  if (name.startsWith('科学原理') || name.startsWith('原理分析')) return 'principle'
  return null
}

function netParenDelta(value) {
  const opens = (value.match(/（/g)?.length ?? 0) + (value.match(/\(/g)?.length ?? 0)
  const closes = (value.match(/）/g)?.length ?? 0) + (value.match(/\)/g)?.length ?? 0)
  return opens - closes
}

/** Re-join materials split on 、 inside （…） / (...). */
export function mergeQimengParenMaterials(materials) {
  if (!materials?.length) return []
  const result = []
  let buffer = null
  for (const item of materials) {
    const part = String(item ?? '').trim()
    if (!part) continue
    if (buffer !== null) {
      buffer = `${buffer}、${part}`
      if (netParenDelta(buffer) <= 0) {
        result.push(buffer)
        buffer = null
      }
      continue
    }
    if (netParenDelta(part) > 0) {
      buffer = part
      continue
    }
    result.push(part)
  }
  if (buffer !== null) result.push(buffer)
  return result
}

function normalizeMaterialsText(text) {
  return String(text || '')
    .replace(/^实验材料\s*[：:∶]?\s*/g, '')
    .replace(/\s*0[12]\s*$/g, '')
    .trim()
}

function splitMaterialsLine(text) {
  const line = normalizeMaterialsText(text)
  if (!line) return []
  const raw = line
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 200))
  return mergeQimengParenMaterials(raw).slice(0, 50)
}

function parseStepsFromLines(lines) {
  const steps = []
  for (const raw of lines) {
    const line = String(raw || '').trim()
    if (!line) continue
    if (IGNORE_SECTION_RE.test(line)) continue
    if (/^（.+）$/.test(line)) continue
    const numbered = line.match(/^(\d+)[、.．]\s*(.+)$/)
    if (numbered) {
      steps.push({
        title: `步骤 ${numbered[1]}`,
        description: numbered[2].trim().slice(0, 1000),
        sort_order: Number(numbered[1]) - 1,
      })
      continue
    }
    if (steps.length) {
      const last = steps[steps.length - 1]
      last.description = `${last.description}\n${line}`.slice(0, 1000)
    }
  }
  if (steps.length) return steps

  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .filter((line) => !IGNORE_SECTION_RE.test(line) && !/^（.+）$/.test(line))
    .map((body, index) => ({
      title: `步骤 ${index + 1}`,
      description: body.slice(0, 1000),
      sort_order: index,
    }))
}

function parsePrincipleFromLines(lines) {
  let text = lines.join('\n').trim()
  text = text.replace(/^(?:科学原理\d*|原理分析)\s*[：:∶]?\s*/u, '')
  return stripQimengWeChatCta(text).trim()
}

/**
 * Parse partner 启蒙版 content.txt. Accepts:
 * - `实验材料` with optional `：`/`:` then a same-line list or a following line
 * - `实验步骤` / `实验步骤01` (digits optional)
 * - `科学原理` / `科学原理02` (digits optional)
 * Strips WeChat CTAs before splitting sections.
 */
export function parseQimengContentTxt(text) {
  const normalized = collapseBlankLines(stripQimengWeChatCta(text))
  const sections = { materials: [], steps: [], principle: [] }
  let current = null

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^\d{1,2}$/.test(trimmed)) continue

    const header = trimmed.match(SECTION_HEADER_RE)
    if (header) {
      let kind = classifySectionHeader(header[1])
      const rest = header[2].trim()
      // Some dumps typo the steps header as a second empty `实验材料：`.
      if (kind === 'materials' && sections.materials.length && !rest) kind = 'steps'
      current = kind
      if (rest && kind && sections[kind]) sections[kind].push(rest)
      continue
    }
    if (IGNORE_SECTION_RE.test(trimmed)) {
      current = 'ignore'
      continue
    }
    if (current && current !== 'ignore' && sections[current]) {
      sections[current].push(trimmed)
    }
  }

  const materials = splitMaterialsLine(sections.materials.join('、'))
  const steps = parseStepsFromLines(sections.steps)
  const principle = parsePrincipleFromLines(sections.principle)
  const materialsLine = materials.join('、')

  return { materials, steps, principle, materialsLine }
}

/** Alias used by the import script. */
export const parseContentTxt = parseQimengContentTxt

/**
 * Build the stored project description from the parsed 科学原理.
 * Pass digest only as a last-resort fallback (import); rehydrate must not.
 */
export function buildQimengDescription({ principle, digest } = {}) {
  const science = stripQimengWeChatCta(principle || '').trim()
  const summary = stripQimengWeChatCta(digest || '').trim()
  let text
  if (science) {
    text = /^(科学原理|原理分析)/.test(science) ? science : `科学原理：${science}`
  } else if (summary) {
    text = summary
  } else {
    text = '材料与步骤见正文。'
  }
  text = cleanQimengDescription(text)
  if (text.length > 2000) text = `${text.slice(0, 1997)}...`
  return text
}

export const buildDescription = buildQimengDescription

export function qimengMaterialsOrFallback(materials) {
  return materials?.length ? materials : [FALLBACK_MATERIAL]
}

export function qimengStepsOrFallback(steps) {
  return steps?.length ? steps : [{ ...FALLBACK_STEP }]
}

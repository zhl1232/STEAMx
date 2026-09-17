/**
 * Shared 启蒙版 copy cleanup: strip preview-batch chrome from titles,
 * descriptions, reflections, steps, and tags. Keeps 启蒙版 + qimeng-src:*.
 */

export const TAG_SOURCE = '启蒙版'
export const TAG_PREVIEW = '预览'
export const TITLE_PREFIX = '【预览】'

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

export function isQimengSourceTag(tag) {
  return /^qimeng-src:/i.test(String(tag || '').trim())
}

function collapseBlankLines(text) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  const raw = String(description || '').replace(/\r\n/g, '\n').trim()
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
  let text = String(description || '').replace(/\r\n/g, '\n').trim()
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
  let text = String(reflection || '').replace(/\r\n/g, '\n').trim()
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

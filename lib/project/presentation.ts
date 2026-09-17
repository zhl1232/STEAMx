/**
 * Detail-page presentation helpers for imported experiment projects:
 * strip raw demo-video URLs when a player is shown, soften 启蒙 prefixes,
 * and repair materials split on 、 inside （…）.
 */

const VIDEO_LINE_RE =
  /^(?:演示视频(?:（外链）)?|【演示视频】)\s*[:：]?\s*(?:https:\/\/\S+\.mp4)?\s*$/u
const BARE_MP4_LINE_RE = /^https:\/\/\S+\.mp4\s*$/i
const VIDEO_INLINE_PREFIX_RE = /^【演示视频】\s*https:\/\/\S+\.mp4\s*/u
const DESC_BANNER_RE = /^【启蒙版[·・]?预览】\s*$/u
const SOURCE_LINE_RE = /^来源：伙伴启蒙版实验.*/u

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function collapseBlankLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Clean description for display; drop raw video URL lines when the player is present. */
export function formatProjectDescriptionForDisplay(
  description: string | null | undefined,
  options: { hasVideoPlayer?: boolean } = {},
): string {
  const raw = normalizeNewlines(description ?? '').trim()
  if (!raw) return ''

  const lines = raw.split('\n')
  const kept: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push('')
      continue
    }
    if (DESC_BANNER_RE.test(trimmed)) {
      // Soften noisy import banner — omit rather than show 【启蒙版·预览】.
      continue
    }
    if (options.hasVideoPlayer && (VIDEO_LINE_RE.test(trimmed) || BARE_MP4_LINE_RE.test(trimmed))) {
      continue
    }
    if (options.hasVideoPlayer && /https:\/\/\S+\.mp4/i.test(trimmed) && /演示视频/.test(trimmed)) {
      continue
    }
    if (SOURCE_LINE_RE.test(trimmed)) {
      kept.push('来源：启蒙科学实验（预览）')
      continue
    }
    kept.push(line.trimEnd())
  }

  return collapseBlankLines(kept.join('\n'))
}

/** Strip leading 【演示视频】https://…mp4 prefix from a step body. */
export function formatProjectStepDescriptionForDisplay(
  description: string | null | undefined,
  options: { hasVideoPlayer?: boolean } = {},
): string {
  let text = normalizeNewlines(description ?? '').trim()
  if (!text) return ''

  if (options.hasVideoPlayer) {
    text = text.replace(VIDEO_INLINE_PREFIX_RE, '')
    text = text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        if (!trimmed) return true
        if (VIDEO_LINE_RE.test(trimmed) || BARE_MP4_LINE_RE.test(trimmed)) return false
        return true
      })
      .join('\n')
  }

  return collapseBlankLines(text)
}

/**
 * Re-join materials that were split on 、 inside full-width parentheses,
 * e.g. ["自备（纯牛奶", "洗洁精", "盘子）"] → ["自备（纯牛奶、洗洁精、盘子）"].
 */
export function mergeBrokenParenMaterials(materials: string[]): string[] {
  if (materials.length === 0) return materials

  const result: string[] = []
  let buffer: string | null = null

  const netParen = (value: string) => {
    const opens = (value.match(/（/g)?.length ?? 0) + (value.match(/\(/g)?.length ?? 0)
    const closes = (value.match(/）/g)?.length ?? 0) + (value.match(/\)/g)?.length ?? 0)
    return opens - closes
  }

  for (const item of materials) {
    const part = String(item ?? '').trim()
    if (!part) continue

    if (buffer !== null) {
      buffer = `${buffer}、${part}`
      if (netParen(buffer) <= 0) {
        result.push(buffer)
        buffer = null
      }
      continue
    }

    if (netParen(part) > 0) {
      buffer = part
      continue
    }

    result.push(part)
  }

  if (buffer !== null) result.push(buffer)
  return result
}

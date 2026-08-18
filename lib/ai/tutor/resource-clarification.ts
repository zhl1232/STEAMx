/**
 * 小迪在检索站内资源前给出的澄清问题。
 *
 * 这个类型会同时经过服务端 SSE、会话历史和客户端消息状态，因此放在
 * 不依赖服务端运行时的共享模块里，并在边界处做一次轻量归一化。
 */
export type TutorResourceClarificationOption = {
  id: string
  label: string
}

export type TutorResourceClarification = {
  prompt: string
  options: TutorResourceClarificationOption[]
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f ? ' ' : character
  }).join('')

  return withoutControls
    .replaceAll('[', ' ')
    .replaceAll(']', ' ')
    .replaceAll('{', ' ')
    .replaceAll('}', ' ')
    .replaceAll('<', ' ')
    .replaceAll('>', ' ')
    .replaceAll('|', ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * 只接受适合直接展示给学生的 2-4 个选项，避免模型输出把 Markdown/协议
 * 标记带进聊天气泡或历史记录。
 */
export function normalizeTutorResourceClarification(
  value: unknown,
): TutorResourceClarification | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as { prompt?: unknown; question?: unknown; options?: unknown; choices?: unknown }
  const prompt = cleanText(raw.prompt ?? raw.question, 160)
  const rawOptions = raw.options ?? raw.choices
  if (!prompt || !Array.isArray(rawOptions)) return null

  const seen = new Set<string>()
  const options: TutorResourceClarificationOption[] = []
  for (const [index, item] of rawOptions.entries()) {
    const option = typeof item === 'string'
      ? { label: item, id: '' }
      : item && typeof item === 'object'
        ? item as { id?: unknown; label?: unknown; text?: unknown; title?: unknown }
        : null
    if (!option) continue
    const label = cleanText(option.label ?? option.text ?? option.title, 48)
    if (!label || seen.has(label)) continue

    const suppliedId = typeof option.id === 'string'
      ? option.id.toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, 40)
      : ''
    const id = suppliedId || `option-${index + 1}`
    if (options.some((candidate) => candidate.id === id)) continue

    seen.add(label)
    options.push({ id, label })
    if (options.length >= 4) break
  }

  return options.length >= 2 ? { prompt, options } : null
}

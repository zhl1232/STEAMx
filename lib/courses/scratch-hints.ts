import type { CourseLessonStep, LessonContent } from '@/lib/courses/types'

export type ScratchBlockHintReason = 'stuck' | 'next_step' | 'review'
export type ScratchBlockCategory =
  | 'motion'
  | 'looks'
  | 'sound'
  | 'events'
  | 'control'
  | 'sensing'
  | 'operators'
  | 'data'
  | 'myBlocks'

export type ScratchBlockHintItem = {
  /** Final block text used by the lesson goal. */
  label: string
  /** Text the student can actually find in the Scratch toolbox first. */
  findLabel: string
  /** Scratch category used to render the block with the same color as the editor. */
  category?: ScratchBlockCategory
  /** Extra visual cue for finding the default block. */
  findHint?: string
  /** Parameter/text edit to make after dragging the default block. */
  editHint?: string
}

export type ScratchBlockHint = {
  stepIndex: number
  keywords: string[]
  items?: ScratchBlockHintItem[]
  reason: ScratchBlockHintReason
  category?: ScratchBlockCategory
}

const SCRATCH_RICH_TEXT_TOKEN_RE = /\[\[(cat|block):([A-Za-z][A-Za-z0-9_-]*)(?:\|([^\]]*))?\]\]/g

const SCRATCH_RICH_TEXT_CATEGORY_LABELS: Record<string, string> = {
  motion: '运动',
  looks: '外观',
  sound: '声音',
  events: '事件',
  control: '控制',
  sensing: '侦测',
  operators: '运算',
  variables: '变量',
  data: '变量',
  myblocks: '自制积木',
  music: '音乐',
  pen: '画笔',
}

const SCRATCH_RICH_TEXT_CATEGORY_KEYS: Record<string, ScratchBlockCategory> = {
  motion: 'motion',
  looks: 'looks',
  sound: 'sound',
  events: 'events',
  control: 'control',
  sensing: 'sensing',
  operators: 'operators',
  variables: 'data',
  data: 'data',
  myblocks: 'myBlocks',
}

const SCRATCH_BLOCK_KEYWORDS = [
  '当绿旗被点击',
  '当角色被点击',
  '当按下',
  '移动',
  '转动',
  '面向',
  '碰到边缘就反弹',
  '碰到颜色',
  '碰到',
  '重复执行',
  '重复',
  '如果',
  '否则',
  '等待',
  '广播消息',
  '广播',
  '收到消息',
  '切换背景',
  '下一个背景',
  '切换造型',
  '下一个造型',
  '说',
  '播放声音',
  '声音',
  '变量',
  '分数',
  '计时器',
  '随机数',
  '方向键',
  '鼠标指针',
  '克隆',
  '画笔',
]

const KEYWORD_CATEGORY_ENTRIES: Array<[string, ScratchBlockCategory]> = [
  ['当绿旗被点击', 'events'],
  ['当角色被点击', 'events'],
  ['当按下', 'events'],
  ['广播消息', 'events'],
  ['广播', 'events'],
  ['收到消息', 'events'],
  ['重复执行', 'control'],
  ['重复', 'control'],
  ['如果', 'control'],
  ['否则', 'control'],
  ['等待', 'control'],
  ['克隆', 'control'],
  ['移动', 'motion'],
  ['转动', 'motion'],
  ['面向', 'motion'],
  ['碰到边缘就反弹', 'motion'],
  ['方向键', 'motion'],
  ['鼠标指针', 'motion'],
  ['切换背景', 'looks'],
  ['下一个背景', 'looks'],
  ['切换造型', 'looks'],
  ['下一个造型', 'looks'],
  ['说', 'looks'],
  ['外观', 'looks'],
  ['播放声音', 'sound'],
  ['声音', 'sound'],
  ['碰到颜色', 'sensing'],
  ['碰到', 'sensing'],
  ['计时器', 'sensing'],
  ['随机数', 'operators'],
  ['变量', 'data'],
  ['分数', 'data'],
  ['画笔', 'myBlocks'],
]

function addUniqueValue(values: string[], value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue || values.includes(normalizedValue)) return
  values.push(normalizedValue)
}

function addKeyword(keywords: string[], keyword: string) {
  const normalizedKeyword = keyword.trim()
  if (!normalizedKeyword) return

  const shorterDuplicate = keywords.find(
    (existing) => existing.includes(normalizedKeyword) && existing.length > normalizedKeyword.length,
  )
  if (shorterDuplicate) return

  const existingIndex = keywords.findIndex(
    (existing) => normalizedKeyword.includes(existing) && normalizedKeyword.length > existing.length,
  )
  if (existingIndex >= 0) {
    keywords.splice(existingIndex, 1, normalizedKeyword)
    return
  }

  if (keywords.includes(normalizedKeyword)) return
  keywords.push(normalizedKeyword)
}

function createSimpleHintItem(label: string): ScratchBlockHintItem {
  const normalized = label.trim()
  return {
    label: normalized,
    findLabel: normalized,
    category: resolveKeywordCategory(normalized),
  }
}

function normalizeSpeechText(value: string) {
  return value.trim()
}

function normalizeScratchBlockHintItem(label: string, category?: ScratchBlockCategory): ScratchBlockHintItem {
  const normalized = label.trim()

  if (normalized === '当绿旗被点击') {
    return {
      label: normalized,
      findLabel: normalized,
      category: category ?? 'events',
      findHint: '黄色事件帽子，带绿色小旗图标',
    }
  }

  const sayForSecondsMatch = normalized.match(/^说\s+(.+?)\s*持续\s*([0-9.]+)\s*秒$/u)
  if (sayForSecondsMatch) {
    return {
      label: normalized,
      findLabel: `说 你好! ${sayForSecondsMatch[2]} 秒`,
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(sayForSecondsMatch[1] ?? '')}」`,
    }
  }

  const sayMatch = normalized.match(/^说\s+(.+)$/u)
  if (sayMatch) {
    return {
      label: normalized,
      findLabel: '说 你好!',
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(sayMatch[1] ?? '')}」`,
    }
  }

  const keyPressMatch = normalized.match(/^当按下\s+(.+?)\s*键$/u)
  if (keyPressMatch) {
    return {
      label: normalized,
      findLabel: '当按下 空格 键',
      category: category ?? 'events',
      editHint: `把按键改成「${keyPressMatch[1]?.trim() ?? ''}」`,
    }
  }

  const coordinateChangeMatch = normalized.match(/^将\s+([xy])\s*坐标增加\s+(-?[0-9.]+)$/u)
  if (coordinateChangeMatch && coordinateChangeMatch[2]?.startsWith('-')) {
    return {
      label: normalized,
      findLabel: `将 ${coordinateChangeMatch[1]} 坐标增加 10`,
      category: category ?? 'motion',
      editHint: `把数字改成「${coordinateChangeMatch[2]}」`,
    }
  }

  const waitMatch = normalized.match(/^等待\s+([0-9.]+)\s*秒$/u)
  if (waitMatch && waitMatch[1] !== '1') {
    return {
      label: normalized,
      findLabel: '等待 1 秒',
      category: category ?? 'control',
      editHint: `把秒数改成「${waitMatch[1]}」`,
    }
  }

  return {
    ...createSimpleHintItem(normalized),
    category: category ?? resolveKeywordCategory(normalized),
  }
}

function normalizeRichTextCategoryKey(categoryKey: string) {
  return categoryKey.trim().replace(/[-_]/g, '').toLowerCase()
}

export function normalizeScratchRichTextCategoryKey(categoryKey: string): ScratchBlockCategory | undefined {
  return SCRATCH_RICH_TEXT_CATEGORY_KEYS[normalizeRichTextCategoryKey(categoryKey)]
}

export function getScratchRichTextCategoryLabel(categoryKey: string) {
  return SCRATCH_RICH_TEXT_CATEGORY_LABELS[normalizeRichTextCategoryKey(categoryKey)]
}

export type ScratchRichTextToken =
  | { type: 'text'; text: string }
  | { type: 'category'; category: ScratchBlockCategory | undefined; categoryKey: string; label: string }
  | { type: 'block'; category: ScratchBlockCategory | undefined; categoryKey: string; label: string }

export function parseScratchRichTextTokens(text: string): ScratchRichTextToken[] {
  if (!text) return []
  const tokens: ScratchRichTextToken[] = []
  let lastIndex = 0
  SCRATCH_RICH_TEXT_TOKEN_RE.lastIndex = 0

  for (const match of text.matchAll(SCRATCH_RICH_TEXT_TOKEN_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, index) })
    }

    const [, kind, categoryKey, label] = match
    const category = normalizeScratchRichTextCategoryKey(categoryKey)
    if (kind === 'cat') {
      tokens.push({
        type: 'category',
        category,
        categoryKey,
        label: getScratchRichTextCategoryLabel(categoryKey) ?? categoryKey,
      })
    } else {
      tokens.push({ type: 'block', category, categoryKey, label: label ?? '' })
    }
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', text }]
}

export function stripScratchRichTextMarkers(text: string) {
  if (!text) return ''
  return text
    .replace(SCRATCH_RICH_TEXT_TOKEN_RE, (_token, kind: string, categoryKey: string, label?: string) => {
      if (kind === 'block') {
        const item = normalizeScratchBlockHintItem(label ?? '', normalizeScratchRichTextCategoryKey(categoryKey))
        return [
          item.findLabel,
          item.findHint ? `（${item.findHint}）` : '',
          item.editHint ? `（${item.editHint}）` : '',
        ].join('')
      }
      const categoryLabel = getScratchRichTextCategoryLabel(categoryKey)
      return categoryLabel ? `${categoryLabel}分类` : '对应分类'
    })
    .replace(/分类\s+的/g, '分类的')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function keepScratchRichTextBlockMarkers(text: string) {
  if (!text) return ''
  return text
    .replace(SCRATCH_RICH_TEXT_TOKEN_RE, (token, kind: string, categoryKey: string) => {
      if (kind === 'block') return token
      const categoryLabel = getScratchRichTextCategoryLabel(categoryKey)
      return categoryLabel ? `${categoryLabel}分类` : '对应分类'
    })
    .replace(/分类\s+的/g, '分类的')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function extractScratchRichTextBlockItems(text: string) {
  const items: ScratchBlockHintItem[] = []
  for (const match of text.matchAll(SCRATCH_RICH_TEXT_TOKEN_RE)) {
    const [, kind, categoryKey, label] = match
    if (kind !== 'block') continue
    if (typeof label === 'string' && label.trim()) {
      items.push(normalizeScratchBlockHintItem(label.trim(), normalizeScratchRichTextCategoryKey(categoryKey)))
    }
  }
  return items
}

function addHintItem(items: ScratchBlockHintItem[], item: ScratchBlockHintItem) {
  if (!item.findLabel.trim()) return
  if (items.some((existing) => existing.findLabel === item.findLabel && existing.editHint === item.editHint)) return
  items.push(item)
}

export function buildScratchBlockHintItems(input: {
  step?: CourseLessonStep | null
  lessonContent?: LessonContent | null
  maxItems?: number
}) {
  const maxItems = input.maxItems ?? 4
  const stepTextParts = [
    input.step?.title,
    input.step?.description,
    input.step?.hint,
    ...(input.step?.checklist ?? []),
  ]
    .filter(Boolean)
    .map(String)

  const items: ScratchBlockHintItem[] = []
  for (const text of stepTextParts) {
    for (const item of extractScratchRichTextBlockItems(text)) {
      addHintItem(items, item)
      if (items.length >= maxItems) return items
    }
  }
  if (items.length > 0) return items

  const stepText = stepTextParts
    .map((value) => stripScratchRichTextMarkers(value))
    .join(' ')

  const keywords: string[] = []
  for (const keyword of SCRATCH_BLOCK_KEYWORDS) {
    if (stepText.includes(keyword)) addKeyword(keywords, keyword)
    if (keywords.length >= maxItems) break
  }

  for (const keyword of keywords) {
    addHintItem(items, createSimpleHintItem(keyword))
    if (items.length >= maxItems) return items
  }

  const requiredBlocks = input.lessonContent?.requiredBlocks ?? []
  for (const block of requiredBlocks) {
    addHintItem(items, normalizeScratchBlockHintItem(block.label))
    if (items.length >= maxItems) return items
  }

  return items
}

export function buildScratchBlockHintKeywords(input: {
  step?: CourseLessonStep | null
  lessonContent?: LessonContent | null
  maxKeywords?: number
}) {
  const keywords: string[] = []
  for (const item of buildScratchBlockHintItems({ ...input, maxItems: input.maxKeywords })) {
    addUniqueValue(keywords, item.findLabel)
  }

  return keywords
}

function resolveKeywordCategory(keyword: string) {
  const normalized = keyword.trim()
  if (!normalized) return undefined
  for (const [pattern, category] of KEYWORD_CATEGORY_ENTRIES) {
    if (normalized.includes(pattern) || pattern.includes(normalized)) return category
  }
  return undefined
}

export function resolveScratchBlockCategory(keywords: string[]): ScratchBlockCategory | undefined {
  const categories = new Set<ScratchBlockCategory>()
  for (const keyword of keywords) {
    const category = resolveKeywordCategory(keyword)
    if (category) categories.add(category)
    if (categories.size > 1) return undefined
  }
  return [...categories][0]
}

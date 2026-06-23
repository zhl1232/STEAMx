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

export type ScratchBlockHint = {
  stepIndex: number
  keywords: string[]
  reason: ScratchBlockHintReason
  category?: ScratchBlockCategory
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

function addKeyword(keywords: string[], keyword: string) {
  if (!keyword || keywords.includes(keyword)) return
  keywords.push(keyword)
}

export function buildScratchBlockHintKeywords(input: {
  step?: CourseLessonStep | null
  lessonContent?: LessonContent | null
  maxKeywords?: number
}) {
  const maxKeywords = input.maxKeywords ?? 4
  const stepText = [
    input.step?.title,
    input.step?.description,
    input.step?.hint,
    ...(input.step?.checklist ?? []),
  ]
    .filter(Boolean)
    .join(' ')
  const keywords: string[] = []

  for (const keyword of SCRATCH_BLOCK_KEYWORDS) {
    if (stepText.includes(keyword)) addKeyword(keywords, keyword)
    if (keywords.length >= maxKeywords) return keywords
  }

  const requiredBlocks = input.lessonContent?.requiredBlocks ?? []
  for (const block of requiredBlocks) {
    addKeyword(keywords, block.label)
    if (keywords.length >= maxKeywords) return keywords
  }

  return keywords
}

export function resolveScratchBlockCategory(keywords: string[]): ScratchBlockCategory | undefined {
  for (const keyword of keywords) {
    const normalized = keyword.trim()
    if (!normalized) continue
    for (const [pattern, category] of KEYWORD_CATEGORY_ENTRIES) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) return category
    }
  }
  return undefined
}

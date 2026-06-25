import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { ScratchBlockCategory, ScratchBlockHintItem } from '@/lib/courses/scratch-hints'

function clampIndex(value: number | undefined, max: number) {
  if (max < 0) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

function scratchMarkerCategory(category: ScratchBlockCategory) {
  return category === 'myBlocks' ? 'myblocks' : category
}

function formatScratchBlockForPrompt(
  item: ScratchBlockHintItem | undefined,
  keyword: string | undefined,
  fallbackCategory?: ScratchBlockCategory,
) {
  const label = item?.findLabel?.trim() || keyword?.trim()
  if (!label) return ''
  const category = item?.category ?? fallbackCategory
  return category ? `[[block:${scratchMarkerCategory(category)}|${label}]]` : label
}

export function buildTutorReplyFocusSummary(input: {
  toolCalls: TutorToolCall[]
  previousLessonStepIndex?: number
}) {
  const highlightScratchBlocksCall = input.toolCalls.find(
    (toolCall) => toolCall.name === 'course.highlight_scratch_blocks',
  )
  if (!highlightScratchBlocksCall) return ''

  const focusLessonStepCall = input.toolCalls.find((toolCall) => toolCall.name === 'course.focus_lesson_step')
  const stepIndex = highlightScratchBlocksCall.payload.stepIndex
  const itemCount = Math.max(
    highlightScratchBlocksCall.payload.items?.length ?? 0,
    highlightScratchBlocksCall.payload.keywords.length,
  )
  const targetItemIndex = clampIndex(highlightScratchBlocksCall.payload.targetItemIndex, itemCount - 1) ?? 0
  const item = highlightScratchBlocksCall.payload.items?.[targetItemIndex]
  const keyword = highlightScratchBlocksCall.payload.keywords[targetItemIndex]
  const blockLabel = formatScratchBlockForPrompt(item, keyword, highlightScratchBlocksCall.payload.category)
  const editHint = item?.editHint?.trim()
  const sameLessonStep =
    focusLessonStepCall?.name === 'course.focus_lesson_step'
      ? focusLessonStepCall.payload.stepIndex === stepIndex
      : input.previousLessonStepIndex === stepIndex
  const interpretedAsSubAction =
    sameLessonStep && highlightScratchBlocksCall.payload.reason === 'next_step' && itemCount > 1

  return [
    '【本轮页面工具焦点】',
    `页面已经把学生留在第${stepIndex + 1}步的第${targetItemIndex + 1}/${Math.max(itemCount, 1)}个 Scratch 动作。`,
    interpretedAsSubAction
      ? '学生这次问“然后呢/下一步”时，已经被页面工具解释为当前步骤里的下一个 Scratch 动作，不是下一课时步骤。'
      : '',
    `本条回复只能讲当前高亮动作${blockLabel ? `：${blockLabel}` : ''}${editHint ? `；拖出后${editHint}` : ''}。`,
    `不要讲第${stepIndex + 2}步、下一课时步骤或后续内容，除非本轮页面工具已经切到那一步。`,
  ]
    .filter(Boolean)
    .join('\n')
}

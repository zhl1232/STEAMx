import {
  buildScratchBlockHintItems,
  type ScratchBlockHintItem,
} from '@/lib/courses/scratch-hints'
import type {
  ScratchEditorBlockContext,
  ScratchEditorBlockValue,
  ScratchEditorContext,
  ScratchEditorTargetContext,
} from '@/lib/courses/scratch-messages'
import type { CourseLessonStep, LessonContent } from '@/lib/courses/types'

export type ScratchStepCheckItemStatus = 'complete' | 'missing' | 'needs_edit' | 'needs_review'

export type ScratchStepCheckItemResult = {
  item: ScratchBlockHintItem
  originalIndex: number
  status: ScratchStepCheckItemStatus
  matchedBlockIds: string[]
  detail: string
}

export type ScratchStepCheckResult = {
  status: 'complete' | 'needs_work' | 'unknown'
  reason?: 'no_items' | 'no_editor_context' | 'no_selected_target'
  targetName?: string
  total: number
  completeCount: number
  nextTargetItemIndex?: number
  items: ScratchStepCheckItemResult[]
}

type ExpectedScratchValue = {
  value: string
  kind: 'text' | 'number' | 'key' | 'option'
}

export const OPCODE_ONLY_SCRATCH_BLOCK_IDS = new Set([
  'event_whenflagclicked',
  'event_whenthisspriteclicked',
  'control_forever',
  'motion_ifonedgebounce',
  'looks_nextbackdrop',
  'looks_nextcostume',
])

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

export function getSelectedScratchTarget(context?: ScratchEditorContext | null) {
  if (!context || !Array.isArray(context.targets) || context.targets.length === 0) return null
  return (
    context.targets.find((target) => target.id === context.selectedTargetId) ??
    context.targets.find((target) => target.name === context.selectedTargetName) ??
    null
  )
}

export function getSelectedScratchBlockTypes(context?: ScratchEditorContext | null) {
  const selected = getSelectedScratchTarget(context)
  const blocks = selected?.blocks
  if (!Array.isArray(blocks) || blocks.length === 0) return new Set<string>()
  return new Set(
    blocks
      .map((block) => block.type.trim())
      .filter(Boolean),
  )
}

export function canTreatExistingOpcodeAsComplete(item: ScratchBlockHintItem) {
  const blockIds = item.blockIds ?? []
  if (blockIds.length === 0) return false
  if (item.editHint?.trim()) return false
  if (item.label.trim() !== item.findLabel.trim()) return false
  return blockIds.every((blockId) => OPCODE_ONLY_SCRATCH_BLOCK_IDS.has(blockId))
}

function normalizeComparable(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[！]/g, '!')
    .replace(/[？]/g, '?')
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.')
    .toLowerCase()
}

function normalizeKey(value: string) {
  const normalized = normalizeComparable(value)
  const keyAliases: Record<string, string> = {
    '←': 'leftarrow',
    左: 'leftarrow',
    左键: 'leftarrow',
    左箭头: 'leftarrow',
    left: 'leftarrow',
    leftarrow: 'leftarrow',
    '→': 'rightarrow',
    右: 'rightarrow',
    右键: 'rightarrow',
    右箭头: 'rightarrow',
    right: 'rightarrow',
    rightarrow: 'rightarrow',
    '↑': 'uparrow',
    上: 'uparrow',
    上键: 'uparrow',
    上箭头: 'uparrow',
    up: 'uparrow',
    uparrow: 'uparrow',
    '↓': 'downarrow',
    下: 'downarrow',
    下键: 'downarrow',
    下箭头: 'downarrow',
    down: 'downarrow',
    downarrow: 'downarrow',
    空格: 'space',
    空格键: 'space',
    space: 'space',
  }
  return keyAliases[normalized] ?? normalized
}

function addExpectedValue(values: ExpectedScratchValue[], value: string | undefined, kind: ExpectedScratchValue['kind']) {
  const normalizedValue = value?.trim()
  if (!normalizedValue) return
  const entry = { value: normalizedValue, kind }
  if (values.some((item) => item.value === entry.value && item.kind === entry.kind)) return
  values.push(entry)
}

function extractExpectedValues(item: ScratchBlockHintItem) {
  const values: ExpectedScratchValue[] = []
  const label = item.label.trim().replace(/[？?]$/u, '')

  const editQuoteMatch = item.editHint?.match(/「([^」]+)」/u)
  if (editQuoteMatch?.[1]) addExpectedValue(values, editQuoteMatch[1], 'text')

  const sayForSecondsMatch = label.match(/^说\s+(.+?)\s*持续\s*(-?[0-9.]+)\s*秒$/u)
  if (sayForSecondsMatch) {
    addExpectedValue(values, sayForSecondsMatch[1], 'text')
    addExpectedValue(values, sayForSecondsMatch[2], 'number')
    return values
  }

  const sayMatch = label.match(/^说\s+(.+)$/u)
  if (sayMatch) addExpectedValue(values, sayMatch[1], 'text')

  const keyPressMatch = label.match(/^(?:当)?按下\s+(.+?)\s*键$/u)
  if (keyPressMatch) addExpectedValue(values, keyPressMatch[1], 'key')

  const coordinateChangeMatch = label.match(/^将\s+[xy]\s*坐标增加\s*(-?[0-9.]+)$/u)
  if (coordinateChangeMatch) addExpectedValue(values, coordinateChangeMatch[1], 'number')

  const waitMatch = label.match(/^等待\s*(-?[0-9.]+)\s*秒$/u)
  if (waitMatch) addExpectedValue(values, waitMatch[1], 'number')

  const goToXyMatch = label.match(/^移到\s*x:?\s*(-?[0-9.]+)\s*y:?\s*(-?[0-9.]+)$/u)
  if (goToXyMatch) {
    addExpectedValue(values, goToXyMatch[1], 'number')
    addExpectedValue(values, goToXyMatch[2], 'number')
  }

  const pointDirectionMatch = label.match(/^面向\s*(-?[0-9.]+)\s*方向$/u)
  if (pointDirectionMatch) addExpectedValue(values, pointDirectionMatch[1], 'number')

  const changeVariableMatch = label.match(/^将\s+(.+?)\s+增加\s*(-?[0-9.]+)$/u)
  if (changeVariableMatch) {
    addExpectedValue(values, changeVariableMatch[1], 'text')
    addExpectedValue(values, changeVariableMatch[2], 'number')
  }

  const lessThanMatch = label.match(/^(.+?)\s*<\s*(-?[0-9.]+)$/u)
  if (lessThanMatch) {
    addExpectedValue(values, lessThanMatch[1], 'option')
    addExpectedValue(values, lessThanMatch[2], 'number')
  }

  const musicNumbers = label.match(/^(?:演奏音符|演奏鼓声)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s*拍$/u)
  if (musicNumbers) {
    addExpectedValue(values, musicNumbers[1], 'number')
    addExpectedValue(values, musicNumbers[2], 'number')
  }

  const tempoMatch = label.match(/^将演奏速度设定为\s*(-?[0-9.]+)$/u)
  if (tempoMatch) addExpectedValue(values, tempoMatch[1], 'number')

  const looksNumberMatch = label.match(/^将(?:大小|颜色特效)增加\s*(-?[0-9.]+)$/u)
  if (looksNumberMatch) addExpectedValue(values, looksNumberMatch[1], 'number')

  return values
}

function parseNumbers(value: string) {
  return [...value.matchAll(/-?[0-9]+(?:\.[0-9]+)?/g)].map((match) => Number(match[0]))
}

function comparableMatchesExpected(comparable: string, expected: ExpectedScratchValue) {
  if (expected.kind === 'number') {
    const expectedNumber = Number(expected.value)
    if (!Number.isFinite(expectedNumber)) return false
    return parseNumbers(comparable).some((actualNumber) => Math.abs(actualNumber - expectedNumber) < 0.0001)
  }

  if (expected.kind === 'key') {
    return normalizeKey(comparable) === normalizeKey(expected.value)
  }

  const actual = normalizeComparable(comparable)
  const desired = normalizeComparable(expected.value)
  if (!actual || !desired) return false
  return actual.includes(desired) || desired.includes(actual)
}

function buildBlockMap(blocks: ScratchEditorBlockContext[]) {
  return new Map(blocks.map((block) => [block.id, block]))
}

function collectBlockIdRefs(
  value: ScratchEditorBlockValue | undefined,
  knownBlockIds: Set<string>,
  refs: Set<string>,
) {
  if (value == null) return
  if (typeof value === 'string') {
    if (knownBlockIds.has(value)) refs.add(value)
    return
  }
  if (typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectBlockIdRefs(item, knownBlockIds, refs)
    return
  }
  for (const child of Object.values(value)) collectBlockIdRefs(child, knownBlockIds, refs)
}

function collectComparableValuesFromValue(
  value: ScratchEditorBlockValue | undefined,
  output: string[],
  knownBlockIds: Set<string>,
) {
  if (value == null) return
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim()
    if (text && !knownBlockIds.has(text)) output.push(text)
    return
  }
  if (Array.isArray(value)) {
    const start = typeof value[0] === 'number' && value.length > 1 ? 1 : 0
    for (const item of value.slice(start)) {
      collectComparableValuesFromValue(item, output, knownBlockIds)
    }
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id' || key === 'block' || key === 'shadow') continue
    collectComparableValuesFromValue(child, output, knownBlockIds)
  }
}

function collectBlockComparableValues(
  block: ScratchEditorBlockContext,
  blockMap: Map<string, ScratchEditorBlockContext>,
  seen = new Set<string>(),
) {
  if (seen.has(block.id)) return []
  seen.add(block.id)

  const knownBlockIds = new Set(blockMap.keys())
  const values: string[] = []
  if (block.label) values.push(block.label)
  for (const value of Object.values(block.fields ?? {})) {
    collectComparableValuesFromValue(value, values, knownBlockIds)
  }
  for (const value of Object.values(block.inputs ?? {})) {
    collectComparableValuesFromValue(value, values, knownBlockIds)
  }

  const refs = new Set<string>()
  for (const value of Object.values(block.inputs ?? {})) collectBlockIdRefs(value, knownBlockIds, refs)
  for (const ref of refs) {
    const child = blockMap.get(ref)
    if (child) values.push(...collectBlockComparableValues(child, blockMap, seen))
  }

  return unique(values.map((value) => value.trim()).filter(Boolean))
}

function findMatchingBlocks(target: ScratchEditorTargetContext, item: ScratchBlockHintItem) {
  const blocks = target.blocks ?? []
  const blockIds = new Set((item.blockIds ?? []).map((blockId) => blockId.trim()).filter(Boolean))
  if (blockIds.size === 0) return []
  return blocks.filter((block) => blockIds.has(block.type))
}

function checkScratchStepItem(
  target: ScratchEditorTargetContext,
  blockMap: Map<string, ScratchEditorBlockContext>,
  item: ScratchBlockHintItem,
  originalIndex: number,
): ScratchStepCheckItemResult {
  const matchedBlocks = findMatchingBlocks(target, item)
  if (matchedBlocks.length === 0) {
    return {
      item,
      originalIndex,
      status: 'missing',
      matchedBlockIds: [],
      detail: '还没有在当前对象上找到这个积木',
    }
  }

  const expectedValues = extractExpectedValues(item)
  const matchedBlockIds = matchedBlocks.map((block) => block.id)
  if (expectedValues.length === 0 || canTreatExistingOpcodeAsComplete(item)) {
    return {
      item,
      originalIndex,
      status: 'complete',
      matchedBlockIds,
      detail: '已找到这个积木',
    }
  }

  const comparables = unique(
    matchedBlocks.flatMap((block) => collectBlockComparableValues(block, blockMap)),
  )
  if (comparables.length === 0) {
    return {
      item,
      originalIndex,
      status: 'needs_review',
      matchedBlockIds,
      detail: '已找到积木，但需要在编辑器里核对文字或数字',
    }
  }

  const allExpectedValuesMatch = expectedValues.every((expected) =>
    comparables.some((actual) => comparableMatchesExpected(actual, expected)),
  )

  return {
    item,
    originalIndex,
    status: allExpectedValuesMatch ? 'complete' : 'needs_edit',
    matchedBlockIds,
    detail: allExpectedValuesMatch ? '已找到并匹配到这一步的参数' : '已找到积木，但文字或数字和步骤要求不一致',
  }
}

function shouldCheckConnectionsForStep(step?: CourseLessonStep | null) {
  if (!step) return false
  const text = [
    step.title,
    step.description,
    step.hint,
    ...(step.checklist ?? []),
  ]
    .filter(Boolean)
    .join(' ')
  return /→|接在|接到|拼到|拼在|下面|上面|包住|里放|成立就|放进/u.test(text)
}

function connectedBlockIds(blocks: ScratchEditorBlockContext[], startIds: string[]) {
  const blockMap = buildBlockMap(blocks)
  const knownBlockIds = new Set(blockMap.keys())
  const adjacency = new Map<string, Set<string>>()

  const addEdge = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a || !b || !knownBlockIds.has(a) || !knownBlockIds.has(b)) return
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)?.add(b)
    adjacency.get(b)?.add(a)
  }

  for (const block of blocks) {
    addEdge(block.id, block.next)
    addEdge(block.id, block.parent)
    const refs = new Set<string>()
    for (const value of Object.values(block.inputs ?? {})) collectBlockIdRefs(value, knownBlockIds, refs)
    for (const ref of refs) addEdge(block.id, ref)
  }

  const visited = new Set<string>()
  const queue = startIds.filter((id) => knownBlockIds.has(id))
  for (const id of queue) visited.add(id)

  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }

  return visited
}

function applyConnectionChecks(
  target: ScratchEditorTargetContext,
  results: ScratchStepCheckItemResult[],
): ScratchStepCheckItemResult[] {
  const blocks = target.blocks ?? []
  if (blocks.length < 2) return results

  let connectedToPrevious = results[0]?.matchedBlockIds ?? []
  return results.map((result, index) => {
    if (index === 0 || result.status !== 'complete' || connectedToPrevious.length === 0) {
      if (result.status === 'complete') connectedToPrevious = [...connectedToPrevious, ...result.matchedBlockIds]
      return result
    }

    const reachable = connectedBlockIds(blocks, connectedToPrevious)
    const isConnected = result.matchedBlockIds.some((blockId) => reachable.has(blockId))
    if (isConnected) {
      connectedToPrevious = [...connectedToPrevious, ...result.matchedBlockIds]
      return result
    }

    return {
      ...result,
      status: 'needs_review',
      detail: '已找到积木，但要确认它和前一个动作拼在一起',
    }
  })
}

export function evaluateScratchStepItems(input: {
  items: ScratchBlockHintItem[]
  editorContext?: ScratchEditorContext | null
  checkConnections?: boolean
}) {
  const items = input.items.slice(0, 8)
  const target = getSelectedScratchTarget(input.editorContext)
  if (items.length === 0) {
    return {
      status: 'unknown',
      reason: 'no_items',
      total: 0,
      completeCount: 0,
      items: [],
    } satisfies ScratchStepCheckResult
  }

  if (!input.editorContext) {
    return {
      status: 'unknown',
      reason: 'no_editor_context',
      total: items.length,
      completeCount: 0,
      nextTargetItemIndex: 0,
      items: items.map((item, originalIndex) => ({
        item,
        originalIndex,
        status: 'missing',
        matchedBlockIds: [],
        detail: 'Scratch 编辑器状态还没有同步',
      })),
    } satisfies ScratchStepCheckResult
  }

  if (!target) {
    return {
      status: 'unknown',
      reason: 'no_selected_target',
      total: items.length,
      completeCount: 0,
      nextTargetItemIndex: 0,
      items: items.map((item, originalIndex) => ({
        item,
        originalIndex,
        status: 'missing',
        matchedBlockIds: [],
        detail: '还没有选中要检查的角色或舞台',
      })),
    } satisfies ScratchStepCheckResult
  }

  const blockMap = buildBlockMap(target.blocks ?? [])
  const checkedItems = items.map((item, originalIndex) =>
    checkScratchStepItem(target, blockMap, item, originalIndex),
  )
  const results = input.checkConnections ? applyConnectionChecks(target, checkedItems) : checkedItems
  const completeCount = results.filter((result) => result.status === 'complete').length
  const nextTargetItemIndex = results.find((result) => result.status !== 'complete')?.originalIndex

  return {
    status: completeCount === results.length ? 'complete' : 'needs_work',
    targetName: target.name,
    total: results.length,
    completeCount,
    nextTargetItemIndex,
    items: results,
  } satisfies ScratchStepCheckResult
}

export function buildScratchStepCheck(input: {
  step?: CourseLessonStep | null
  lessonContent?: LessonContent | null
  editorContext?: ScratchEditorContext | null
}) {
  const items = buildScratchBlockHintItems({
    step: input.step,
    lessonContent: input.lessonContent,
    maxItems: 8,
  })
  return evaluateScratchStepItems({
    items,
    editorContext: input.editorContext,
    checkConnections: shouldCheckConnectionsForStep(input.step),
  })
}

export function filterScratchBlockItemsByExistingBlocks(
  items: ScratchBlockHintItem[],
  context?: ScratchEditorContext | null,
) {
  const check = evaluateScratchStepItems({ items, editorContext: context })
  const pendingItems: ScratchBlockHintItem[] = []
  const existingItems: ScratchBlockHintItem[] = []
  const pendingOriginalIndexes: number[] = []

  for (const result of check.items) {
    if (result.status === 'complete') {
      existingItems.push(result.item)
    } else {
      pendingItems.push(result.item)
      pendingOriginalIndexes.push(result.originalIndex)
    }
  }

  return { pendingItems, existingItems, pendingOriginalIndexes }
}

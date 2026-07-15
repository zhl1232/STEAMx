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
  | 'music'
  | 'pen'

export type ScratchBlockHintItem = {
  /** Final block text used by the lesson goal. */
  label: string
  /** Text the student can actually find in the Scratch toolbox first. */
  findLabel: string
  /** Scratch opcode candidates for locating the block in the flyout. */
  blockIds?: string[]
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
  music: 'music',
  pen: 'pen',
}

const SCRATCH_BLOCK_KEYWORDS = [
  '当绿旗被点击',
  '当角色被点击',
  '当按下',
  '按下',
  '移动',
  '滑行',
  '移到最前面',
  '移到最后面',
  '移到',
  '转动',
  '面向',
  '将 x 坐标设为',
  '将 y 坐标设为',
  '碰到边缘就反弹',
  '碰到颜色',
  '碰到',
  '询问并等待',
  '询问',
  '回答',
  '响度',
  '重复执行直到',
  '重复执行',
  '重复',
  '如果',
  '否则',
  '等待直到',
  '等待',
  '广播消息并等待',
  '广播消息',
  '广播',
  '收到消息',
  '切换背景',
  '下一个背景',
  '切换造型',
  '下一个造型',
  '思考',
  '显示',
  '隐藏',
  '前移',
  '后移',
  '将大小增加',
  '将大小设为',
  '将颜色特效增加',
  '将颜色特效设为',
  '清除图形特效',
  '设为',
  '说',
  '停止所有声音',
  '播放声音',
  '将音量增加',
  '将音量设为',
  '音量',
  '声音',
  '变量',
  '分数',
  '得分',
  '计时器归零',
  '计时器',
  '鼠标的 x 坐标',
  '鼠标的 y 坐标',
  '按下鼠标',
  '随机数',
  '连接',
  '除以',
  '余数',
  '四舍五入',
  '停止',
  '演奏音符',
  '演奏鼓声',
  '演奏速度',
  '方向键',
  '鼠标指针',
  '建立克隆体',
  '当作为克隆体启动时',
  '删除此克隆体',
  '克隆',
  '清空画笔',
  '落笔',
  '抬笔',
  '将笔的大小设为',
  '画笔',
]

const KEYWORD_CATEGORY_ENTRIES: Array<[string, ScratchBlockCategory]> = [
  ['当绿旗被点击', 'events'],
  ['当角色被点击', 'events'],
  ['当按下', 'events'],
  ['广播消息并等待', 'events'],
  ['广播消息', 'events'],
  ['广播', 'events'],
  ['收到消息', 'events'],
  ['重复执行直到', 'control'],
  ['重复执行', 'control'],
  ['重复', 'control'],
  ['如果', 'control'],
  ['否则', 'control'],
  ['等待直到', 'control'],
  ['等待', 'control'],
  ['停止', 'control'],
  ['建立克隆体', 'control'],
  ['当作为克隆体启动时', 'control'],
  ['删除此克隆体', 'control'],
  ['克隆', 'control'],
  ['移动', 'motion'],
  ['滑行', 'motion'],
  ['移到最前面', 'looks'],
  ['移到最后面', 'looks'],
  ['前移', 'looks'],
  ['后移', 'looks'],
  ['移到', 'motion'],
  ['转动', 'motion'],
  ['面向', 'motion'],
  ['将 x 坐标设为', 'motion'],
  ['将 y 坐标设为', 'motion'],
  ['碰到边缘就反弹', 'motion'],
  ['方向键', 'motion'],
  ['鼠标指针', 'motion'],
  ['切换背景', 'looks'],
  ['下一个背景', 'looks'],
  ['切换造型', 'looks'],
  ['下一个造型', 'looks'],
  ['思考', 'looks'],
  ['显示', 'looks'],
  ['隐藏', 'looks'],
  ['将大小增加', 'looks'],
  ['将大小设为', 'looks'],
  ['将颜色特效增加', 'looks'],
  ['将颜色特效设为', 'looks'],
  ['清除图形特效', 'looks'],
  ['设为', 'data'],
  ['说', 'looks'],
  ['外观', 'looks'],
  ['停止所有声音', 'sound'],
  ['播放声音', 'sound'],
  ['将音量增加', 'sound'],
  ['将音量设为', 'sound'],
  ['音量', 'sound'],
  ['声音', 'sound'],
  ['碰到颜色', 'sensing'],
  ['碰到', 'sensing'],
  ['按下鼠标', 'sensing'],
  ['按下', 'sensing'],
  ['询问并等待', 'sensing'],
  ['询问', 'sensing'],
  ['回答', 'sensing'],
  ['响度', 'sensing'],
  ['鼠标的 x 坐标', 'sensing'],
  ['鼠标的 y 坐标', 'sensing'],
  ['计时器归零', 'sensing'],
  ['计时器', 'sensing'],
  ['随机数', 'operators'],
  ['连接', 'operators'],
  ['除以', 'operators'],
  ['余数', 'operators'],
  ['四舍五入', 'operators'],
  ['与', 'operators'],
  ['或', 'operators'],
  ['不成立', 'operators'],
  ['变量', 'data'],
  ['分数', 'data'],
  ['得分', 'data'],
  ['演奏音符', 'music'],
  ['演奏鼓声', 'music'],
  ['演奏速度', 'music'],
  ['清空画笔', 'pen'],
  ['落笔', 'pen'],
  ['抬笔', 'pen'],
  ['将笔的大小设为', 'pen'],
  ['画笔', 'pen'],
]

const SCRATCH_BLOCK_ID_ENTRIES: Array<[string, string[]]> = [
  ['当绿旗被点击', ['event_whenflagclicked']],
  ['当角色被点击', ['event_whenthisspriteclicked']],
  ['当按下', ['event_whenkeypressed']],
  ['广播消息并等待', ['event_broadcastandwait']],
  ['广播消息', ['event_broadcast']],
  ['广播', ['event_broadcast']],
  ['收到消息', ['event_whenbroadcastreceived']],
  ['停止 全部', ['control_stop']],
  ['如果…那么否则', ['control_if_else']],
  ['如果...那么否则', ['control_if_else']],
  ['重复执行直到', ['control_repeat_until']],
  ['重复执行', ['control_forever']],
  ['重复', ['control_repeat']],
  ['如果', ['control_if']],
  ['等待直到', ['control_wait_until']],
  ['等待', ['control_wait']],
  ['建立克隆体', ['control_create_clone_of']],
  ['当作为克隆体启动时', ['control_start_as_clone']],
  ['删除此克隆体', ['control_delete_this_clone']],
  ['移到最前面', ['looks_gotofrontback']],
  ['移到最后面', ['looks_gotofrontback']],
  ['移到 x:', ['motion_gotoxy']],
  ['移到', ['motion_goto']],
  ['移动', ['motion_movesteps']],
  ['转动', ['motion_turnright', 'motion_turnleft']],
  ['面向', ['motion_pointtowards', 'motion_pointindirection']],
  ['将 x 坐标设为', ['motion_setx']],
  ['将 y 坐标设为', ['motion_sety']],
  ['碰到边缘就反弹', ['motion_ifonedgebounce']],
  ['将大小设为', ['looks_setsizeto']],
  ['将大小增加', ['looks_changesizeby']],
  ['将颜色特效增加', ['looks_changeeffectby']],
  ['将颜色特效设为', ['looks_seteffectto']],
  ['清除图形特效', ['looks_cleargraphiceffects']],
  ['前移', ['looks_goforwardbackwardlayers']],
  ['后移', ['looks_goforwardbackwardlayers']],
  ['显示', ['looks_show']],
  ['隐藏', ['looks_hide']],
  ['切换背景', ['looks_switchbackdropto']],
  ['换成 背景', ['looks_switchbackdropto']],
  ['下一个背景', ['looks_nextbackdrop']],
  ['切换造型', ['looks_switchcostumeto']],
  ['下一个造型', ['looks_nextcostume']],
  ['停止所有声音', ['sound_stopallsounds']],
  ['播放声音', ['sound_play', 'sound_playuntildone']],
  ['将音量增加', ['sound_changevolumeby']],
  ['将音量设为', ['sound_setvolumeto']],
  ['碰到颜色', ['sensing_touchingcolor']],
  ['碰到', ['sensing_touchingobject']],
  ['询问并等待', ['sensing_askandwait']],
  ['回答', ['sensing_answer']],
  ['按下鼠标', ['sensing_mousedown']],
  ['鼠标的 x 坐标', ['sensing_mousex']],
  ['鼠标的 y 坐标', ['sensing_mousey']],
  ['响度', ['sensing_loudness']],
  ['按下', ['sensing_keypressed']],
  ['计时器归零', ['sensing_resettimer']],
  ['计时器', ['sensing_timer']],
  ['将 分数 增加', ['data_changevariableby']],
  ['将 得分 增加', ['data_changevariableby']],
  ['>', ['operator_gt']],
  ['y 坐标 <', ['operator_lt']],
  ['<', ['operator_lt']],
  ['=', ['operator_equals']],
  ['随机数', ['operator_random']],
  ['连接', ['operator_join']],
  ['余数', ['operator_mod']],
  ['四舍五入', ['operator_round']],
  ['不成立', ['operator_not']],
  ['与', ['operator_and']],
  ['或', ['operator_or']],
  ['演奏音符', ['music_playNoteForBeats']],
  ['演奏鼓声', ['music_midiPlayDrumForBeats']],
  ['将演奏速度设定为', ['music_setTempo']],
  ['清空画笔', ['pen_clear']],
  ['落笔', ['pen_penDown']],
  ['抬笔', ['pen_penUp']],
  ['将笔的大小设为', ['pen_setPenSizeTo']],
  ['设为', ['data_setvariableto']],
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
  return withInferredBlockIds({
    label: normalized,
    findLabel: normalized,
    category: resolveKeywordCategory(normalized),
  })
}

function normalizeSpeechText(value: string) {
  return value.trim()
}

function normalizeScratchBlockHintItem(label: string, category?: ScratchBlockCategory): ScratchBlockHintItem {
  const normalized = label.trim()

  if (normalized === '当绿旗被点击') {
    return withInferredBlockIds({
      label: normalized,
      findLabel: normalized,
      category: category ?? 'events',
      findHint: '黄色事件帽子，带绿色小旗图标',
    })
  }

  const sayForSecondsMatch = normalized.match(/^说\s+(.+?)\s*持续\s*([0-9.]+)\s*秒$/u)
  if (sayForSecondsMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: `说 你好! ${sayForSecondsMatch[2]} 秒`,
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(sayForSecondsMatch[1] ?? '')}」`,
    })
  }

  const sayMatch = normalized.match(/^说\s+(.+)$/u)
  if (sayMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '说 你好!',
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(sayMatch[1] ?? '')}」`,
    })
  }

  const thinkForSecondsMatch = normalized.match(/^思考\s+(.+?)\s*(?:持续\s*)?([0-9.]+)\s*秒$/u)
  if (thinkForSecondsMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: `思考 嗯... ${thinkForSecondsMatch[2]} 秒`,
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(thinkForSecondsMatch[1] ?? '')}」`,
    })
  }

  const thinkMatch = normalized.match(/^思考\s+(.+)$/u)
  if (thinkMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '思考 嗯...',
      category: category ?? 'looks',
      editHint: `把文字改成「${normalizeSpeechText(thinkMatch[1] ?? '')}」`,
    })
  }

  const askMatch = normalized.match(/^询问\s+(.+?)\s*并等待$/u)
  if (askMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '询问 你叫什么名字？ 并等待',
      category: category ?? 'sensing',
      editHint: `把问题改成「${normalizeSpeechText(askMatch[1] ?? '')}」`,
    })
  }

  const volumeSetMatch = normalized.match(/^将音量设为\s+(-?[0-9.]+)/u)
  if (volumeSetMatch && volumeSetMatch[1] !== '100') {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '将音量设为 100%',
      category: category ?? 'sound',
      editHint: `把音量改成「${volumeSetMatch[1]}」`,
    })
  }

  const keyPressMatch = normalized.match(/^当按下\s+(.+?)\s*键$/u)
  if (keyPressMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '当按下 空格 键',
      category: category ?? 'events',
      editHint: `把按键改成「${keyPressMatch[1]?.trim() ?? ''}」`,
    })
  }

  const coordinateChangeMatch = normalized.match(/^将\s+([xy])\s*坐标增加\s+(-?[0-9.]+)$/u)
  if (coordinateChangeMatch && coordinateChangeMatch[2]?.startsWith('-')) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: `将 ${coordinateChangeMatch[1]} 坐标增加 10`,
      category: category ?? 'motion',
      editHint: `把数字改成「${coordinateChangeMatch[2]}」`,
    })
  }

  const coordinateSetMatch = normalized.match(/^将\s+([xy])\s*坐标设为\s+(.+)$/u)
  if (coordinateSetMatch) {
    return withInferredBlockIds({
      label: normalized,
      findLabel: `将 ${coordinateSetMatch[1]} 坐标设为 0`,
      category: category ?? 'motion',
      editHint: `把数值改成「${coordinateSetMatch[2]?.trim() ?? ''}」`,
    })
  }

  const sizeSetMatch = normalized.match(/^将大小设为\s+(-?[0-9.]+)$/u)
  if (sizeSetMatch && sizeSetMatch[1] !== '100') {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '将大小设为 100',
      category: category ?? 'looks',
      editHint: `把大小改成「${sizeSetMatch[1]}」`,
    })
  }

  const penSizeSetMatch = normalized.match(/^将笔的大小设为\s+(-?[0-9.]+)$/u)
  if (penSizeSetMatch && penSizeSetMatch[1] !== '1') {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '将笔的大小设为 1',
      category: category ?? 'pen',
      editHint: `把笔粗细改成「${penSizeSetMatch[1]}」`,
    })
  }

  const waitMatch = normalized.match(/^等待\s+([0-9.]+)\s*秒$/u)
  if (waitMatch && waitMatch[1] !== '1') {
    return withInferredBlockIds({
      label: normalized,
      findLabel: '等待 1 秒',
      category: category ?? 'control',
      editHint: `把秒数改成「${waitMatch[1]}」`,
    })
  }

  return withInferredBlockIds({
    ...createSimpleHintItem(normalized),
    category: category ?? resolveKeywordCategory(normalized),
  })
}

function withBlockIds(item: ScratchBlockHintItem, blockIds?: string[]) {
  const safeBlockIds: string[] = []
  for (const blockId of blockIds ?? []) {
    const safeBlockId = blockId.trim()
    if (safeBlockId && !safeBlockIds.includes(safeBlockId)) safeBlockIds.push(safeBlockId)
    if (safeBlockIds.length >= 6) break
  }
  return safeBlockIds.length > 0 ? { ...item, blockIds: safeBlockIds } : item
}

function inferScratchBlockIds(item: Pick<ScratchBlockHintItem, 'label' | 'findLabel'>) {
  const labels = [item.findLabel, item.label].filter(Boolean)
  const blockIds: string[] = []

  for (const label of labels) {
    const normalized = label.trim()
    if (!normalized) continue

    if (/^重复执行\s*[0-9.]+\s*次$/u.test(normalized)) {
      blockIds.push('control_repeat')
      continue
    }

    if (/^滑行\s*[0-9.]+\s*秒到\s*x:/u.test(normalized)) {
      blockIds.push('motion_glidesecstoxy')
      continue
    }
    if (/^滑行\s*[0-9.]+\s*秒(?:滑行)?到/u.test(normalized)) {
      blockIds.push('motion_glideto')
      continue
    }

    if (/^思考\s+.+?\s*持续\s*[0-9.]+\s*秒$/u.test(normalized) || /^思考\s+.+?\s+[0-9.]+\s*秒$/u.test(normalized)) {
      blockIds.push('looks_thinkforsecs')
      continue
    }
    if (/^思考(\s|$)/u.test(normalized)) {
      blockIds.push('looks_think')
      continue
    }

    if (/^询问\s.*并等待$/u.test(normalized)) {
      blockIds.push('sensing_askandwait')
      continue
    }

    if (/^广播消息\s.*并等待$/u.test(normalized)) {
      blockIds.push('event_broadcastandwait')
      continue
    }

    if (/特效设为/u.test(normalized)) {
      blockIds.push('looks_seteffectto')
      continue
    }

    if (/^说\s+.+?\s*持续\s*[0-9.]+\s*秒$/u.test(normalized)) {
      blockIds.push('looks_sayforsecs')
    } else if (/^说\s+/u.test(normalized)) {
      blockIds.push('looks_say')
    }

    if (/^将\s+x\s*坐标增加/u.test(normalized)) blockIds.push('motion_changexby')
    if (/^将\s+y\s*坐标增加/u.test(normalized)) blockIds.push('motion_changeyby')

    for (const [pattern, ids] of SCRATCH_BLOCK_ID_ENTRIES) {
      if (normalized.includes(pattern)) {
        blockIds.push(...ids)
        break
      }
    }
  }

  return blockIds
}

function withInferredBlockIds(item: ScratchBlockHintItem) {
  return withBlockIds(item, inferScratchBlockIds(item))
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
    const item = normalizeScratchBlockHintItem(block.label)
    addHintItem(items, withBlockIds(item, [...(item.blockIds ?? []), ...block.anyOf]))
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

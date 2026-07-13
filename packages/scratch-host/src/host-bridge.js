import { isEmbedMode } from './asset-host.js'
import { activateTutorialDeck, syncGuiProjectReady } from './gui-sync.js'
import { patchScratchStorageForEmbed } from './storage-patch.js'
import { attachVmHooks } from './vm-hooks.js'

const SOURCE = 'steam-scratch-host'
const PARENT_SOURCE = 'steam-scratch-parent'
const CATEGORY_LABELS = {
  motion: '运动',
  looks: '外观',
  sound: '声音',
  events: '事件',
  control: '控制',
  sensing: '侦测',
  operators: '运算',
  data: '变量',
  myBlocks: '自制积木',
  music: '音乐',
  pen: '画笔',
}
const CATEGORY_IDS = new Set(Object.keys(CATEGORY_LABELS))
const FLYOUT_DOM_CATEGORY_BY_HINT_CATEGORY = {
  motion: 'motion',
  looks: 'looks',
  sound: 'sounds',
  events: 'events',
  control: 'control',
  sensing: 'sensing',
  operators: 'operators',
  data: 'data',
  myBlocks: 'more',
  music: 'music',
  pen: 'pen',
}
const FLYOUT_DOM_BLOCK_MATCHERS = {
  event_whenflagclicked: { category: 'events', texts: ['whenclicked', '当绿旗被点击'], index: 0 },
  event_whenkeypressed: { category: 'events', texts: ['whenkeypressed', 'keypressed', '当按下'] },
  event_whenthisspriteclicked: { category: 'events', texts: ['whenthisspriteclicked', 'whenstageclicked', '当角色被点击'] },
  event_whenbackdropswitchesto: { category: 'events', texts: ['whenbackdropswitchesto', '当背景切换'] },
  event_broadcast: { category: 'events', texts: ['broadcast', '广播'] },
  event_whenbroadcastreceived: { category: 'events', texts: ['whenireceive', '收到消息'] },
  control_wait: { category: 'control', texts: ['waitseconds', '等待'] },
  control_repeat: { category: 'control', texts: ['repeat'], rejectTexts: ['repeatuntil'] },
  control_forever: { category: 'control', texts: ['forever', '重复执行'] },
  control_if: { category: 'control', texts: ['ifthen', '如果'] },
  control_if_else: { category: 'control', texts: ['ifthenelse', '否则'] },
  control_stop: { category: 'control', texts: ['stopall', '停止'] },
  motion_movesteps: { category: 'motion', texts: ['movesteps', '移动'] },
  motion_goto: { category: 'motion', texts: ['goto', '移到'], rejectTexts: ['gotoxy'] },
  motion_gotoxy: { category: 'motion', texts: ['gotoxy', '移到x'] },
  motion_turnright: { category: 'motion', texts: ['turndegrees', '右转'] },
  motion_turnleft: { category: 'motion', texts: ['turndegrees', '左转'] },
  motion_pointtowards: { category: 'motion', texts: ['pointtowards', '面向'] },
  motion_pointindirection: { category: 'motion', texts: ['pointindirection', '面向'] },
  motion_ifonedgebounce: { category: 'motion', texts: ['ifonedgebounce', '碰到边缘就反弹'] },
  motion_changexby: { category: 'motion', texts: ['changexby', '将x坐标增加'] },
  motion_changeyby: { category: 'motion', texts: ['changeyby', '将y坐标增加'] },
  looks_say: { category: 'looks', texts: ['say'], rejectTexts: ['sayforseconds', 'think'] },
  looks_sayforsecs: { category: 'looks', texts: ['sayforseconds'] },
  looks_switchbackdropto: { category: 'looks', texts: ['switchbackdropto', '切换背景'] },
  looks_nextbackdrop: { category: 'looks', texts: ['nextbackdrop', '下一个背景'] },
  looks_switchcostumeto: { category: 'looks', texts: ['switchcostumeto', '切换造型'] },
  looks_nextcostume: { category: 'looks', texts: ['nextcostume', '下一个造型'] },
  looks_changesizeby: { category: 'looks', texts: ['changesizeby', '将大小增加'] },
  looks_changeeffectby: { category: 'looks', texts: ['changeeffectby', '颜色特效'] },
  sound_play: { category: 'sounds', texts: ['playsound', '播放声音'] },
  sound_playuntildone: { category: 'sounds', texts: ['playsounduntildone', '播放声音'] },
  sensing_touchingobject: { category: 'sensing', texts: ['touching', '碰到'], rejectTexts: ['touchingcolor'] },
  sensing_touchingcolor: { category: 'sensing', texts: ['touchingcolor', '碰到颜色'] },
  sensing_keypressed: { category: 'sensing', texts: ['keypressed', '按下'] },
  sensing_timer: { category: 'sensing', texts: ['timer', '计时器'], rejectTexts: ['resettimer'] },
  operator_random: { category: 'operators', texts: ['pickrandomto', '随机数'] },
  operator_lt: { category: 'operators', texts: ['operator_lt', '<'] },
  data_changevariableby: { category: 'data', texts: ['changevariableby', '增加'] },
  music_playNoteForBeats: { category: 'music', texts: ['playnoteforbeats', '演奏音符'] },
  music_midiPlayDrumForBeats: { category: 'music', texts: ['playdrumforbeats', '演奏鼓声'] },
  music_setTempo: { category: 'music', texts: ['settempotobpm', '将演奏速度设定为'] },
}

let vmRef = null
let playerOnly = false
let guiProjectShowing = false
let loadChain = Promise.resolve()
let pendingAfterGui = null
let bootstrapDone = false
let blockHintDismissTimer = null
let blockHintLocateTimer = null
let highlightedFlyoutBlock = null
let editorContextTimer = null
let lastEditorContextJson = ''

function setStatus(text) {
  const el = document.getElementById('scratch-status')
  if (el) el.textContent = text
}

function postToParent(message) {
  if (window.parent === window) return
  window.parent.postMessage({ ...message, source: SOURCE }, window.location.origin)
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getTargetCostumeName(target) {
  const costumeIndex = typeof target?.currentCostume === 'number' ? target.currentCostume : 0
  const costume = Array.isArray(target?.sprite?.costumes) ? target.sprite.costumes[costumeIndex] : null
  return typeof costume?.name === 'string' ? costume.name : undefined
}

function serializeScratchBlockValue(value, depth = 0) {
  if (depth > 3) return undefined
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    const serialized = value
      .slice(0, 10)
      .map((item) => serializeScratchBlockValue(item, depth + 1))
      .filter((item) => item !== undefined)
    return serialized.length > 0 ? serialized : undefined
  }

  if (typeof value !== 'object') return undefined

  const output = {}
  for (const [key, child] of Object.entries(value).slice(0, 14)) {
    if (typeof child === 'function') continue
    const serialized = serializeScratchBlockValue(child, depth + 1)
    if (serialized !== undefined) output[key] = serialized
  }
  return Object.keys(output).length > 0 ? output : undefined
}

function serializeScratchBlockMap(value) {
  if (!value || typeof value !== 'object') return undefined
  const output = {}
  for (const [key, child] of Object.entries(value).slice(0, 16)) {
    const serialized = serializeScratchBlockValue(child)
    if (serialized !== undefined) output[key] = serialized
  }
  return Object.keys(output).length > 0 ? output : undefined
}

function serializeTargetBlocks(target) {
  const blocks = target?.blocks?._blocks
  if (!blocks || typeof blocks !== 'object') return undefined

  return Object.entries(blocks)
    .map(([id, block]) => {
      if (!block || Array.isArray(block) || typeof block !== 'object') return null
      const type = typeof block.opcode === 'string' ? block.opcode : typeof block.type === 'string' ? block.type : ''
      if (!type) return null
      const next = typeof block.next === 'string' && block.next ? block.next : null
      const parent = typeof block.parent === 'string' && block.parent ? block.parent : null
      return {
        id: String(block.id ?? id),
        type,
        label: typeof block.name === 'string' ? block.name : undefined,
        fields: serializeScratchBlockMap(block.fields),
        inputs: serializeScratchBlockMap(block.inputs),
        next,
        parent,
        topLevel: block.topLevel === true || !parent,
      }
    })
    .filter(Boolean)
    .slice(0, 120)
}

function buildEditorContext(vm) {
  const targets = Array.isArray(vm?.runtime?.targets) ? vm.runtime.targets : []
  const serializedTargets = targets
    .filter(
      (target) =>
        !Object.prototype.hasOwnProperty.call(target, 'isOriginal') ||
        target.isOriginal,
    )
    .slice(0, 20)
    .map((target) => {
      const blocks = target?.blocks?._blocks
      return {
        id: String(target?.id ?? ''),
        name: String(target?.sprite?.name || target?.name || (target?.isStage ? '舞台' : '角色')),
        isStage: Boolean(target?.isStage),
        x: safeNumber(target?.x),
        y: safeNumber(target?.y),
        direction: safeNumber(target?.direction),
        size: safeNumber(target?.size),
        visible: typeof target?.visible === 'boolean' ? target.visible : undefined,
        costumeName: getTargetCostumeName(target),
        blockCount: blocks && typeof blocks === 'object' ? Object.keys(blocks).length : undefined,
        blocks: serializeTargetBlocks(target),
      }
    })
    .filter((target) => target.id && target.name)

  const selectedTarget = vm?.editingTarget
  const selectedTargetName =
    selectedTarget?.sprite?.name || selectedTarget?.name || (selectedTarget?.isStage ? '舞台' : undefined)

  return {
    selectedTargetId: selectedTarget?.id ? String(selectedTarget.id) : undefined,
    selectedTargetName: selectedTargetName ? String(selectedTargetName) : undefined,
    targets: serializedTargets,
  }
}

function postEditorContextNow() {
  if (!vmRef) return
  const context = buildEditorContext(vmRef)
  const json = JSON.stringify(context)
  if (json === lastEditorContextJson) return
  lastEditorContextJson = json
  postToParent({ type: 'EDITOR_CONTEXT', context })
}

function scheduleEditorContextPost(delay = 120) {
  if (editorContextTimer) clearTimeout(editorContextTimer)
  editorContextTimer = setTimeout(() => {
    editorContextTimer = null
    postEditorContextNow()
  }, delay)
}

function normalizeCategory(category) {
  return typeof category === 'string' && CATEGORY_IDS.has(category) ? category : null
}

function getBlockHintOverlay() {
  let overlay = document.getElementById('scratch-block-hint-overlay')
  if (overlay) return overlay

  overlay = document.createElement('div')
  overlay.id = 'scratch-block-hint-overlay'
  overlay.setAttribute('role', 'status')
  overlay.innerHTML = [
    '<div class="scratch-block-hint-title">可以先找这些积木</div>',
    '<div class="scratch-block-hint-category"></div>',
    '<div class="scratch-block-hint-keywords"></div>',
    '<button type="button" class="scratch-block-hint-close" aria-label="关闭积木提示">×</button>',
  ].join('')
  overlay.querySelector('.scratch-block-hint-close')?.addEventListener('click', () => {
    hideBlockHintOverlay()
  })
  document.body.appendChild(overlay)
  return overlay
}

function hideBlockHintOverlay() {
  if (blockHintDismissTimer) {
    clearTimeout(blockHintDismissTimer)
    blockHintDismissTimer = null
  }
  if (blockHintLocateTimer) {
    clearTimeout(blockHintLocateTimer)
    blockHintLocateTimer = null
  }
  clearFlyoutBlockHighlight()
  document.getElementById('scratch-block-hint-overlay')?.remove()
}

function findScratchWorkspace() {
  const scratchBlocks = window.ScratchBlocks ?? window.Blockly
  if (scratchBlocks && typeof scratchBlocks.getMainWorkspace === 'function') {
    const workspace = scratchBlocks.getMainWorkspace()
    if (workspace?.toolbox_) return workspace
  }
  return null
}

function escapeCssIdent(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value)
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function isScratchCategorySelected(toolbox, categoryId) {
  if (typeof toolbox?.getSelectedCategoryId !== 'function') return true
  return toolbox.getSelectedCategoryId() === categoryId
}

function dispatchCategoryMouseup(element) {
  element.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  )
  element.click()
}

function selectScratchCategory(category) {
  const categoryId = normalizeCategory(category)
  if (!categoryId) return false

  const workspace = findScratchWorkspace()
  if (workspace?.toolbox_) {
    try {
      if (typeof workspace.toolbox_.setSelectedCategoryById === 'function') {
        workspace.toolbox_.setSelectedCategoryById(categoryId)
        if (isScratchCategorySelected(workspace.toolbox_, categoryId)) return true
      }
      if (typeof workspace.toolbox_.scrollToCategoryById === 'function') {
        workspace.toolbox_.scrollToCategoryById(categoryId)
        if (isScratchCategorySelected(workspace.toolbox_, categoryId)) return true
      }
    } catch (err) {
      console.warn('[scratch-host] category API selection failed:', err)
    }
  }

  const safeCategoryId = escapeCssIdent(categoryId)
  const selector = [
    `.scratchCategoryId-${safeCategoryId}`,
    `[data-id="${categoryId}"]`,
    `[data-category="${categoryId}"]`,
    `[id="${categoryId}"]`,
  ].join(',')
  const element = document.querySelector(selector)
  if (element instanceof HTMLElement) {
    dispatchCategoryMouseup(element)
    return true
  }
  return false
}

function selectSpriteForMotionHint(category) {
  if (category !== 'motion' || !vmRef?.editingTarget?.isStage) return false

  const sprite = vmRef.runtime?.targets?.find((target) => !target?.isStage && target?.isOriginal !== false)
  if (!sprite?.id || typeof vmRef.setEditingTarget !== 'function') return false

  try {
    vmRef.setEditingTarget(sprite.id)
    syncTargetsToGui(vmRef)
    drawStage(vmRef)
    return true
  } catch (err) {
    console.warn('[scratch-host] could not select a sprite for motion hint:', err)
    return false
  }
}

function normalizeTextForMatch(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[！]/g, '!')
    .replace(/[？]/g, '?')
    .toLowerCase()
}

function normalizeHintItems(items, keywords) {
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        const findLabel = typeof item?.findLabel === 'string' ? item.findLabel.trim() : ''
        const label = typeof item?.label === 'string' ? item.label.trim() : findLabel
        const category = normalizeCategory(item?.category)
        const blockIds = Array.isArray(item?.blockIds)
          ? item.blockIds
              .map((blockId) => (typeof blockId === 'string' ? blockId.trim() : ''))
              .filter(Boolean)
              .slice(0, 6)
          : []
        return { label, findLabel, blockIds, category }
      })
      .filter((item) => item.findLabel)
      .slice(0, 4)
  }

  return keywords.map((keyword) => ({
    label: keyword,
    findLabel: keyword,
    blockIds: [],
    category: null,
  }))
}

function getFirstHintItemCategory(items) {
  const item = items.find((candidate) => normalizeCategory(candidate.category))
  return item ? normalizeCategory(item.category) : null
}

function getFlyoutWorkspace() {
  const workspace = findScratchWorkspace()
  const flyout = workspace?.getFlyout?.() ?? workspace?.toolbox_?.flyout_
  const flyoutWorkspace = flyout?.getWorkspace?.()
  if (!flyout || !flyoutWorkspace || typeof flyoutWorkspace.getTopBlocks !== 'function') return null
  return { flyout, flyoutWorkspace }
}

function getBlockText(block) {
  try {
    if (typeof block?.toString === 'function') {
      return block.toString(80, '')
    }
  } catch {
    // Fall through to an empty string; flyout location is best-effort.
  }
  return ''
}

function getFlyoutDomBlocks() {
  return Array.from(document.querySelectorAll('.blocklyFlyout .blocklyDraggable[data-category]'))
    .filter((element) => element instanceof Element)
}

function getFlyoutDomCategory(category) {
  const categoryId = normalizeCategory(category)
  return categoryId ? FLYOUT_DOM_CATEGORY_BY_HINT_CATEGORY[categoryId] ?? categoryId : null
}

function getDomBlockText(element) {
  return normalizeTextForMatch(element.textContent || '')
}

function domBlockMatchesRule(element, rule) {
  const category = element.getAttribute('data-category')
  if (rule.category && category !== rule.category) return false

  const text = getDomBlockText(element)
  if (Array.isArray(rule.rejectTexts)) {
    const rejected = rule.rejectTexts.some((candidate) => text.includes(normalizeTextForMatch(candidate)))
    if (rejected) return false
  }
  return rule.texts.some((candidate) => text.includes(normalizeTextForMatch(candidate)))
}

function findFlyoutDomBlockByRule(blockId) {
  const rule = FLYOUT_DOM_BLOCK_MATCHERS[blockId]
  if (!rule) return null

  const categoryBlocks = getFlyoutDomBlocks().filter(
    (element) => element.getAttribute('data-category') === rule.category,
  )
  const matchedByText = categoryBlocks.find((element) => domBlockMatchesRule(element, rule))
  if (matchedByText) return matchedByText

  if (typeof rule.index === 'number') return categoryBlocks[rule.index] ?? null
  return null
}

function findFlyoutDomBlockByText(item) {
  const expectedCategory = getFlyoutDomCategory(item.category)
  const candidateTexts = [item.findLabel, item.label].map(normalizeTextForMatch).filter(Boolean)
  if (!candidateTexts.length) return null

  return getFlyoutDomBlocks().find((element) => {
    if (expectedCategory && element.getAttribute('data-category') !== expectedCategory) return false
    const text = getDomBlockText(element)
    return candidateTexts.some((candidate) => text.includes(candidate) || candidate.includes(text))
  }) ?? null
}

function findMatchingFlyoutDomBlock(items, keywords) {
  const normalizedItems = normalizeHintItems(items, keywords)

  for (const item of normalizedItems) {
    for (const blockId of item.blockIds) {
      const element = findFlyoutDomBlockByRule(blockId)
      if (element) return { domElement: element, label: item.findLabel || item.label || blockId }
    }
  }

  for (const item of normalizedItems) {
    const element = findFlyoutDomBlockByText(item)
    if (element) return { domElement: element, label: item.findLabel || item.label }
  }

  for (const keyword of keywords) {
    const element = findFlyoutDomBlockByText({ label: keyword, findLabel: keyword, category: null })
    if (element) return { domElement: element, label: keyword }
  }

  return null
}

function findFlyoutBlockById(blocks, candidateIds) {
  for (const block of blocks) {
    const blockType = String(block?.type ?? '')
    const blockId = String(block?.id ?? '')
    if (candidateIds.has(blockType) || candidateIds.has(blockId)) return block
  }
  return null
}

function findFlyoutBlockByText(blocks, candidateTexts) {
  const normalizedTexts = candidateTexts.map(normalizeTextForMatch).filter(Boolean)
  if (!normalizedTexts.length) return null

  for (const block of blocks) {
    const normalizedBlockText = normalizeTextForMatch(getBlockText(block))
    if (!normalizedBlockText) continue
    const matchedText = normalizedTexts.find(
      (text) => normalizedBlockText.includes(text) || text.includes(normalizedBlockText),
    )
    if (matchedText) return block
  }
  return null
}

function findMatchingFlyoutBlock(items, keywords) {
  const flyoutState = getFlyoutWorkspace()
  if (!flyoutState) return findMatchingFlyoutDomBlock(items, keywords)

  const blocks = flyoutState.flyoutWorkspace.getTopBlocks(false)
  const normalizedItems = normalizeHintItems(items, keywords)

  for (const item of normalizedItems) {
    const candidateIds = new Set(item.blockIds)
    const block = findFlyoutBlockById(blocks, candidateIds)
    if (block) {
      return { ...flyoutState, block, label: item.findLabel || item.label || block.toString?.(60, '') || String(block.type ?? '') }
    }
  }

  for (const item of normalizedItems) {
    const candidateTexts = [item.findLabel]
    if (item.label && item.label !== item.findLabel) candidateTexts.push(item.label)
    const block = findFlyoutBlockByText(blocks, candidateTexts)
    if (block) {
      return { ...flyoutState, block, label: item.findLabel || item.label || block.toString?.(60, '') || getBlockText(block) }
    }
  }

  const block = findFlyoutBlockByText(blocks, keywords)
  if (block) return { ...flyoutState, block, label: keywords[0] || block.toString?.(60, '') || getBlockText(block) }

  return findMatchingFlyoutDomBlock(items, keywords)
}

function clearFlyoutBlockHighlight() {
  if (highlightedFlyoutBlock) {
    highlightedFlyoutBlock.classList.remove('scratch-block-hint-target')
    highlightedFlyoutBlock.removeAttribute('data-steam-scratch-block-hint-target')
    highlightedFlyoutBlock = null
  }
}

function getBlockSvgGroup(block) {
  const svgGroup = block?.svgGroup_
  if (svgGroup instanceof Element) return svgGroup
  const svgRoot = block?.getSvgRoot?.()
  return svgRoot instanceof Element ? svgRoot : null
}

function scrollFlyoutToBlock(flyout, block) {
  const xy = block?.getRelativeToSurfaceXY?.()
  if (!xy) return
  const isHorizontal = Boolean(flyout?.horizontalLayout_)
  const target = Math.max((isHorizontal ? xy.x : xy.y) - 18, 0)
  if (typeof flyout.scrollTo === 'function') {
    flyout.scrollTo(target)
    return
  }
  if (typeof flyout.setScrollPos === 'function') {
    flyout.setScrollPos(target)
  }
}

function highlightFlyoutBlock(block) {
  const svgGroup = getBlockSvgGroup(block)
  if (!svgGroup) return false
  clearFlyoutBlockHighlight()
  svgGroup.classList.add('scratch-block-hint-target')
  svgGroup.setAttribute('data-steam-scratch-block-hint-target', '1')
  highlightedFlyoutBlock = svgGroup
  return true
}

function scrollFlyoutDomBlockIntoView(element) {
  if (typeof element?.scrollIntoView === 'function') {
    try {
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
    } catch {
      element.scrollIntoView()
    }
  }
}

function highlightFlyoutDomBlock(element) {
  if (!(element instanceof Element)) return false
  clearFlyoutBlockHighlight()
  element.classList.add('scratch-block-hint-target')
  element.setAttribute('data-steam-scratch-block-hint-target', '1')
  highlightedFlyoutBlock = element
  return true
}

function scheduleFlyoutBlockLocation(items, keywords, categoryId) {
  if (blockHintLocateTimer) {
    clearTimeout(blockHintLocateTimer)
    blockHintLocateTimer = null
  }
  clearFlyoutBlockHighlight()

  let attempts = 0
  const locate = () => {
    attempts += 1
    const match = findMatchingFlyoutBlock(items, keywords)
    if (!match) {
      if (attempts < 4) {
        blockHintLocateTimer = setTimeout(locate, 160 * attempts)
      } else {
        blockHintLocateTimer = null
      }
      return
    }

    blockHintLocateTimer = null
    if (match.domElement) {
      scrollFlyoutDomBlockIntoView(match.domElement)
      highlightFlyoutDomBlock(match.domElement)
    } else {
      scrollFlyoutToBlock(match.flyout, match.block)
      highlightFlyoutBlock(match.block)
    }

    const label = String(match.label || '').trim()
    const categoryEl = document
      .getElementById('scratch-block-hint-overlay')
      ?.querySelector('.scratch-block-hint-category')
    if (categoryEl) {
      categoryEl.textContent = label
        ? `已定位到「${label}」`
        : categoryId
          ? `已打开「${CATEGORY_LABELS[categoryId]}」分类`
          : ''
      categoryEl.toggleAttribute('hidden', !categoryEl.textContent)
    }
    if (label) setStatus(`已定位积木：${label}`)
  }

  blockHintLocateTimer = setTimeout(locate, categoryId ? 120 : 40)
}

function showBlockHintOverlay(keywords, category, items) {
  const safeKeywords = Array.isArray(keywords)
    ? keywords
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter(Boolean)
        .slice(0, 4)
    : []
  if (safeKeywords.length === 0) {
    hideBlockHintOverlay()
    return
  }

  const safeItems = normalizeHintItems(items, safeKeywords)
  const categoryId = normalizeCategory(category) ?? getFirstHintItemCategory(safeItems)
  selectSpriteForMotionHint(categoryId)
  const categorySelected = selectScratchCategory(categoryId)
  const overlay = getBlockHintOverlay()
  const categoryEl = overlay.querySelector('.scratch-block-hint-category')
  if (categoryEl) {
    categoryEl.textContent = categoryId
      ? `已尝试打开「${CATEGORY_LABELS[categoryId]}」分类`
      : ''
    categoryEl.toggleAttribute('hidden', !categoryId)
  }
  const keywordContainer = overlay.querySelector('.scratch-block-hint-keywords')
  if (keywordContainer) {
    keywordContainer.replaceChildren(
      ...safeKeywords.map((keyword) => {
        const chip = document.createElement('span')
        chip.className = 'scratch-block-hint-chip'
        chip.textContent = keyword
        return chip
      }),
    )
  }
  setStatus(
    categoryId && categorySelected
      ? `已打开${CATEGORY_LABELS[categoryId]}分类`
      : `提示：${safeKeywords.join('、')}`,
  )
  scheduleFlyoutBlockLocation(safeItems, safeKeywords, categoryId)

  if (blockHintDismissTimer) clearTimeout(blockHintDismissTimer)
  blockHintDismissTimer = setTimeout(() => {
    blockHintDismissTimer = null
    hideBlockHintOverlay()
  }, 12000)
}

function hasStageTarget(vm) {
  if (!vm?.runtime?.targets) return false
  return vm.runtime.targets.some((target) => target.isStage)
}

function drawStage(vm) {
  if (vm?.renderer) {
    vm.renderer.draw()
  }
}

function syncTargetsToGui(vm) {
  if (typeof vm.emitTargetsUpdate === 'function') {
    vm.emitTargetsUpdate(false)
  }
}

function enqueueVmLoad(task) {
  loadChain = loadChain
    .then(() => task())
    .catch((err) => {
      console.error('[scratch-host] project load failed:', err)
      throw err
    })
  return loadChain
}

async function waitForRenderer(vm, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (vm?.renderer) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function loadDefaultFromStorage(vm) {
  const storage = vm?.runtime?.storage
  if (!storage) throw new Error('VM storage not ready')

  const asset = await storage.load(
    storage.AssetType.Project,
    '0',
    storage.DataFormat.JSON,
  )
  if (!asset?.data) throw new Error('Default project not found')

  await enqueueVmLoad(async () => {
    await vm.loadProject(asset.data)
  })
}

async function waitForStageTarget(vm, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (hasStageTarget(vm)) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

async function bootstrapDefaultProject(vm) {
  await waitForRenderer(vm)

  let ready = await waitForStageTarget(vm, 15000)

  if (!ready) {
    console.warn('[scratch-host] GUI default project slow; loading project 0 via host')
    await loadDefaultFromStorage(vm)
    ready = await waitForStageTarget(vm, 10000)
  }

  if (!ready) {
    throw new Error('Scratch project failed to initialize')
  }

  if (!playerOnly && typeof vm.start === 'function') {
    vm.start()
  }

  syncTargetsToGui(vm)
  drawStage(vm)

  bootstrapDone = true
  guiProjectShowing = true
  syncGuiOnce()
  setStatus(playerOnly ? '预览模式' : '编辑模式')

  postToParent({ type: 'SCRATCH_READY' })
  scheduleEditorContextPost(0)
  void flushPendingAfterGui()
}

let syncGuiTimer = null

function syncGuiOnce() {
  if (syncGuiProjectReady()) return
  if (syncGuiTimer) return
  let attempts = 0
  syncGuiTimer = setInterval(() => {
    attempts += 1
    if (syncGuiProjectReady() || attempts >= 40) {
      clearInterval(syncGuiTimer)
      syncGuiTimer = null
    }
  }, 50)
}

async function flushPendingAfterGui() {
  if (!pendingAfterGui || !vmRef || !guiProjectShowing) return
  const job = pendingAfterGui
  pendingAfterGui = null
  const force = Boolean(job.force)
  try {
    if (job.type === 'url') {
      await loadProjectFromUrl(job.url, { force })
    } else if (job.type === 'base64') {
      await loadProjectFromBase64(job.base64, { force })
    } else if (job.type === 'ready') {
      await loadProjectFromUrl(null, { force })
    }
  } catch (err) {
    setStatus('加载失败')
    postToParent({
      type: 'PROJECT_LOADED',
      ok: false,
      error: err instanceof Error ? err.message : 'load failed',
    })
  }
}

export function onGuiProjectShowing() {
  if (guiProjectShowing) return
  guiProjectShowing = true
  syncGuiOnce()
  setStatus(playerOnly ? '预览模式' : '编辑模式')
  void flushPendingAfterGui()
}

async function loadProjectBuffer(buffer, { force = false } = {}) {
  if (!vmRef) return
  if (!force && vmRef.__steamUserTouched) {
    postToParent({ type: 'PROJECT_LOADED', ok: true })
    return
  }
  if (force) {
    vmRef.__steamUserTouched = false
  }
  if (!bootstrapDone) {
    await waitForStageTarget(vmRef, 30000)
  }
  await enqueueVmLoad(async () => {
    await vmRef.loadProject(buffer)
    if (!hasStageTarget(vmRef)) {
      throw new Error('Invalid or empty Scratch project')
    }
    // 强制换课后视为干净项目，避免后续误跳过加载
    vmRef.__steamUserTouched = false
    syncTargetsToGui(vmRef)
    drawStage(vmRef)
    scheduleEditorContextPost(0)
  })
}

async function loadProjectFromUrl(url, { force = false } = {}) {
  if (!vmRef) return

  if (!url) {
    if (force) {
      vmRef.__steamUserTouched = false
    }
    if (!hasStageTarget(vmRef)) {
      await waitForStageTarget(vmRef, 30000)
    }
    drawStage(vmRef)
    scheduleEditorContextPost(0)
    postToParent({ type: 'PROJECT_LOADED', ok: true })
    return
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`)
  const buf = await res.arrayBuffer()
  await loadProjectBuffer(buf, { force })
  postToParent({ type: 'PROJECT_LOADED', ok: true })
}

async function loadProjectFromBase64(base64, { force = false } = {}) {
  if (!vmRef) return
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  await loadProjectBuffer(bytes.buffer, { force })
  postToParent({ type: 'PROJECT_LOADED', ok: true })
}

function scheduleProjectLoad(job) {
  if (!guiProjectShowing) {
    pendingAfterGui = job
    return
  }
  const force = Boolean(job.force)
  void (async () => {
    try {
      if (job.type === 'url') await loadProjectFromUrl(job.url, { force })
      else if (job.type === 'base64') await loadProjectFromBase64(job.base64, { force })
      else if (job.type === 'ready') await loadProjectFromUrl(null, { force })
    } catch (err) {
      setStatus('加载失败')
      postToParent({
        type: 'PROJECT_LOADED',
        ok: false,
        error: err instanceof Error ? err.message : 'load failed',
      })
    }
  })()
}

async function saveProjectToParent() {
  if (!vmRef) {
    postToParent({ type: 'PROJECT_SAVED', ok: false, error: 'VM not ready' })
    return
  }
  try {
    setStatus('正在保存…')
    const blob = await vmRef.saveProjectSb3()
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    const base64 = btoa(binary)
    postToParent({ type: 'PROJECT_SAVE_DATA', base64 })
    setStatus('已导出，等待上传…')
  } catch (err) {
    setStatus('保存失败')
    postToParent({
      type: 'PROJECT_SAVED',
      ok: false,
      error: err instanceof Error ? err.message : 'save failed',
    })
  }
}

export function registerHostBridge(vm) {
  vmRef = vm
  if (typeof window !== 'undefined') {
    window.__scratchVm = vm
  }
  patchScratchStorageForEmbed(vm.runtime?.storage)
  attachVmHooks(vm, { syncTargetsToGui, drawStage, onProjectChanged: scheduleEditorContextPost })
  if (typeof vm.on === 'function') {
    ;[
      'PROJECT_CHANGED',
      'targetsUpdate',
      'TARGETS_UPDATE',
      'editingTargetChanged',
      'workspaceUpdate',
      'MONITORS_UPDATE',
    ].forEach((eventName) => {
      try {
        vm.on(eventName, () => scheduleEditorContextPost())
      } catch {
        // Some VM builds do not expose all event names.
      }
    })
  }
  setStatus('加载 Scratch…')

  void bootstrapDefaultProject(vm).catch((err) => {
    setStatus('加载失败')
    console.error('[scratch-host] bootstrap failed:', err)
    postToParent({ type: 'SCRATCH_READY' })
    postToParent({
      type: 'PROJECT_LOADED',
      ok: false,
      error: err instanceof Error ? err.message : 'bootstrap failed',
    })
  })

  if (!isEmbedMode()) {
    document.getElementById('scratch-save-btn')?.addEventListener('click', () => {
      void saveProjectToParent()
    })
  }
}

export function initHostMessageListener() {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return
    const data = event.data
    if (!data || data.source !== PARENT_SOURCE) return

    switch (data.type) {
      case 'SCRATCH_INIT':
        playerOnly = Boolean(data.playerOnly)
        break
      case 'LOAD_PROJECT':
        scheduleProjectLoad(
          data.url
            ? { type: 'url', url: data.url, force: Boolean(data.force) }
            : { type: 'ready', force: Boolean(data.force) },
        )
        break
      case 'LOAD_PROJECT_BUFFER':
        scheduleProjectLoad({
          type: 'base64',
          base64: data.base64,
          force: Boolean(data.force),
        })
        break
      case 'SAVE_PROJECT':
        void saveProjectToParent()
        break
      case 'RUN_PLAYER_ONLY':
        playerOnly = true
        setStatus('预览模式')
        break
      case 'OPEN_TUTORIAL_DECK': {
        // 直达当前课时对应的官方教程图文卡片；GUI 未就绪时回退到打开全部教程
        const opened = activateTutorialDeck(data.deckId)
        if (!opened && typeof window !== 'undefined') {
          document.querySelector('[class*="tutorials-button"]')?.click()
        }
        break
      }
      case 'OPEN_TUTORIALS':
        // 触发 Scratch GUI 的教程按钮点击（打开全部教程列表）
        if (typeof window !== 'undefined') {
          const tutorialButton = document.querySelector('[class*="tutorials-button"]')
          if (tutorialButton) {
            tutorialButton.click()
          }
        }
        break
      case 'HIGHLIGHT_BLOCK_KEYWORDS':
        showBlockHintOverlay(data.keywords, data.category, data.items)
        break
      case 'DISMISS_BLOCK_KEYWORDS':
        hideBlockHintOverlay()
        break
      default:
        break
    }
  })
}

export function getPlayerOnly() {
  return playerOnly
}

export { PARENT_SOURCE }

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
}
const CATEGORY_IDS = new Set(Object.keys(CATEGORY_LABELS))

let vmRef = null
let playerOnly = false
let guiProjectShowing = false
let loadChain = Promise.resolve()
let pendingAfterGui = null
let bootstrapDone = false
let blockHintDismissTimer = null

function setStatus(text) {
  const el = document.getElementById('scratch-status')
  if (el) el.textContent = text
}

function postToParent(message) {
  if (window.parent === window) return
  window.parent.postMessage({ ...message, source: SOURCE }, window.location.origin)
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
  document.getElementById('scratch-block-hint-overlay')?.remove()
}

function findScratchWorkspace() {
  const scratchBlocks = window.ScratchBlocks
  if (scratchBlocks && typeof scratchBlocks.getMainWorkspace === 'function') {
    const workspace = scratchBlocks.getMainWorkspace()
    if (workspace?.toolbox_) return workspace
  }
  return null
}

function selectScratchCategory(category) {
  const categoryId = normalizeCategory(category)
  if (!categoryId) return false

  const workspace = findScratchWorkspace()
  if (workspace?.toolbox_) {
    try {
      if (typeof workspace.toolbox_.setSelectedCategoryById === 'function') {
        workspace.toolbox_.setSelectedCategoryById(categoryId)
        return true
      }
      if (typeof workspace.toolbox_.scrollToCategoryById === 'function') {
        workspace.toolbox_.scrollToCategoryById(categoryId)
        return true
      }
    } catch (err) {
      console.warn('[scratch-host] category API selection failed:', err)
    }
  }

  const selector = [
    `[data-id="${categoryId}"]`,
    `[data-category="${categoryId}"]`,
    `[id="${categoryId}"]`,
  ].join(',')
  const element = document.querySelector(selector)
  if (element instanceof HTMLElement) {
    element.click()
    return true
  }
  return false
}

function showBlockHintOverlay(keywords, category) {
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

  const categoryId = normalizeCategory(category)
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
  try {
    if (job.type === 'url') {
      await loadProjectFromUrl(job.url)
    } else if (job.type === 'base64') {
      await loadProjectFromBase64(job.base64)
    } else if (job.type === 'ready') {
      postToParent({ type: 'PROJECT_LOADED', ok: true })
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

async function loadProjectBuffer(buffer) {
  if (!vmRef) return
  if (vmRef.__steamUserTouched) {
    postToParent({ type: 'PROJECT_LOADED', ok: true })
    return
  }
  if (!bootstrapDone) {
    await waitForStageTarget(vmRef, 30000)
  }
  await enqueueVmLoad(async () => {
    await vmRef.loadProject(buffer)
    if (!hasStageTarget(vmRef)) {
      throw new Error('Invalid or empty Scratch project')
    }
    syncTargetsToGui(vmRef)
    drawStage(vmRef)
  })
}

async function loadProjectFromUrl(url) {
  if (!vmRef) return

  if (!url) {
    if (!hasStageTarget(vmRef)) {
      await waitForStageTarget(vmRef, 30000)
    }
    drawStage(vmRef)
    postToParent({ type: 'PROJECT_LOADED', ok: true })
    return
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`)
  const buf = await res.arrayBuffer()
  await loadProjectBuffer(buf)
  postToParent({ type: 'PROJECT_LOADED', ok: true })
}

async function loadProjectFromBase64(base64) {
  if (!vmRef) return
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  await loadProjectBuffer(bytes.buffer)
  postToParent({ type: 'PROJECT_LOADED', ok: true })
}

function scheduleProjectLoad(job) {
  if (!guiProjectShowing) {
    pendingAfterGui = job
    return
  }
  void (async () => {
    try {
      if (job.type === 'url') await loadProjectFromUrl(job.url)
      else if (job.type === 'base64') await loadProjectFromBase64(job.base64)
      else if (job.type === 'ready') await loadProjectFromUrl(null)
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
  attachVmHooks(vm, { syncTargetsToGui, drawStage })
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
          data.url ? { type: 'url', url: data.url } : { type: 'ready' },
        )
        break
      case 'LOAD_PROJECT_BUFFER':
        scheduleProjectLoad({ type: 'base64', base64: data.base64 })
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
        showBlockHintOverlay(data.keywords, data.category)
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

import React from 'react'
import { createRoot } from 'react-dom/client'

import { prefetchScratchAssets } from './asset-prefetch.js'
import { getAssetHost } from './asset-host.js'
import {
  initHostMessageListener,
  onGuiProjectShowing,
  registerHostBridge,
} from './host-bridge.js'
import { patchScratchStorageForEmbed } from './storage-patch.js'
import { withGuiSyncBridge } from './with-gui-sync-bridge.jsx'

initHostMessageListener()
// 尽早预取默认工程素材，与 GUI 脚本解析并行
prefetchScratchAssets()

function isPlayerOnlyFromUrl() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('playerOnly') === '1'
}

function failStatus(message) {
  const el = document.getElementById('scratch-status')
  if (el) el.textContent = message
  console.error('[scratch-host]', message)
}

function bootScratchHost() {
  const mod = window.GUI
  if (!mod?.default || !mod.AppStateHOC) {
    failStatus('Scratch GUI 脚本未加载')
    return
  }

  const GuiWithBridge = withGuiSyncBridge(mod.default)
  const WrappedGui = mod.AppStateHOC(GuiWithBridge)
  const playerOnly = isPlayerOnlyFromUrl()

  const appElement =
    document.getElementById('scratch-host-root') || document.body
  if (typeof WrappedGui.setAppElement === 'function') {
    WrappedGui.setAppElement(appElement)
  }

  function ScratchHostApp() {
    return (
      <WrappedGui
        canEditTitle
        canSave={false}
        canCreateNew={false}
        canRemix={false}
        enableCommunity={false}
        showComingSoon={false}
        isPlayerOnly={playerOnly}
        assetHost={getAssetHost()}
        onStorageInit={(storage) => {
          patchScratchStorageForEmbed(storage)
        }}
        onProjectLoaded={() => {
          onGuiProjectShowing()
        }}
        onVmInit={(vm) => {
          registerHostBridge(vm)
        }}
      />
    )
  }

  const rootEl = document.getElementById('scratch-host-root')
  if (rootEl) {
    createRoot(rootEl).render(<ScratchHostApp />)
  }
}

function bootWhenReady(attempt = 0) {
  if (window.GUI?.default && window.GUI?.AppStateHOC) {
    bootScratchHost()
    return
  }
  if (attempt > 200) {
    failStatus('Scratch GUI 脚本未加载')
    return
  }
  window.setTimeout(() => bootWhenReady(attempt + 1), 50)
}

bootWhenReady()

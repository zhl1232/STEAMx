import React from 'react'

import { GuiSyncBridge } from './gui-sync-bridge.jsx'

export function withGuiSyncBridge(WrappedGui) {
  function GuiWithSyncBridge(props) {
    return (
      <>
        <GuiSyncBridge />
        <WrappedGui {...props} />
      </>
    )
  }
  GuiWithSyncBridge.displayName = `WithGuiSyncBridge(${
    WrappedGui.displayName || WrappedGui.name || 'GUI'
  })`
  if (WrappedGui.setAppElement) {
    GuiWithSyncBridge.setAppElement = WrappedGui.setAppElement
  }
  return GuiWithSyncBridge
}

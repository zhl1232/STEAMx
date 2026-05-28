import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

import { registerGuiDispatch, unregisterGuiDispatch } from './gui-sync.js'

export function GuiSyncBridge() {
  const dispatch = useDispatch()

  useEffect(() => {
    registerGuiDispatch(dispatch)
    return () => unregisterGuiDispatch()
  }, [dispatch])

  return null
}

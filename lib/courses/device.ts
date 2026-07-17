import { useSyncExternalStore } from 'react'

const SCRATCH_EDITOR_MEDIA_QUERY = '(min-width: 768px)'

/** Tablet/desktop: full Scratch editor; phone: preview + upload only */
export function canUseScratchEditor(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(SCRATCH_EDITOR_MEDIA_QUERY).matches
}

function subscribeToScratchEditorAvailability(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(SCRATCH_EDITOR_MEDIA_QUERY)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

export function useScratchEditorAvailability(): boolean {
  return useSyncExternalStore(
    subscribeToScratchEditorAvailability,
    canUseScratchEditor,
    () => false,
  )
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

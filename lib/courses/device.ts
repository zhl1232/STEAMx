/** Tablet/desktop: full Scratch editor; phone: preview + upload only */
export function canUseScratchEditor(): boolean {
  if (typeof window === 'undefined') return true
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 767px)').matches
  if (narrow && coarse) return false
  return window.matchMedia('(min-width: 768px)').matches
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

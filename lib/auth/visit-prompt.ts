export const VISIT_PROMPT_KEY = 'steamx:visit-prompt:v1'
const HISTORY_KEY = '__steamxVisit'
let consumed: boolean | undefined

/** Per document memory also covers unavailable storage and StrictMode remounts. */
export function hasVisitedPrompt(): boolean {
  if (consumed !== undefined) return consumed
  consumed = false
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    // window.open copies storage, but a new tab has a fresh history entry.
    const freshOpener = window.opener && history.length === 1 && !history.state?.[HISTORY_KEY]
      && navigation?.type !== 'reload' && navigation?.type !== 'back_forward'
    if (freshOpener) sessionStorage.removeItem(VISIT_PROMPT_KEY)
    consumed = sessionStorage.getItem(VISIT_PROMPT_KEY) === '1'
    history.replaceState({ ...history.state, [HISTORY_KEY]: true }, '')
  } catch { /* Storage disabled: use this document's memory. */ }
  return consumed
}

export function markVisitPrompt(): void {
  hasVisitedPrompt()
  consumed = true
  try { sessionStorage.setItem(VISIT_PROMPT_KEY, '1') } catch { /* Memory fallback. */ }
}

export function isVisitPromptRoute(pathname: string): boolean {
  return !['/login', '/auth', '/api', '/admin', '/moderator', '/settings', '/migrate', '/legal',
    '/design-system', '/ldraw-preview', '/xiaodi-preview', '/badges-preview'].some(
    root => pathname === root || pathname.startsWith(`${root}/`),
  )
}

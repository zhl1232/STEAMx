import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules(); vi.restoreAllMocks(); sessionStorage.clear()
  Object.defineProperty(window, 'opener', { configurable: true, value: null })
  history.replaceState({}, '', '/')
})
it('persists across a reload/module boot, but another tab with fresh storage prompts', async () => {
  let guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(false); guard.markVisitPrompt()
  vi.resetModules(); guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(true)
  sessionStorage.clear(); vi.resetModules(); guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(false)
})
it('discards a copied opener flag only on a fresh tab, not its reload', async () => {
  sessionStorage.setItem('steamx:visit-prompt:v1','1')
  Object.defineProperty(window, 'opener', { configurable: true, value: {} })
  vi.spyOn(history, 'length', 'get').mockReturnValue(1)
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'navigate' }] as PerformanceNavigationTiming[])
  let guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(false); guard.markVisitPrompt()
  vi.resetModules(); guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(true)
})
it('falls back to memory when storage is denied and only consumes once', async () => {
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error('disabled') })
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('disabled') })
  const guard = await import('./visit-prompt')
  expect(guard.hasVisitedPrompt()).toBe(false); guard.markVisitPrompt()
  expect(guard.hasVisitedPrompt()).toBe(true); expect(guard.hasVisitedPrompt()).toBe(true)
})

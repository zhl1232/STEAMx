import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaInstallPrompt } from './install-prompt'

vi.mock('next/navigation', () => ({ usePathname: () => '/explore' }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'pwa-test' } }) }))

describe('PWA installation prompt display modes', () => {
  let mode: string
  let listeners: Set<() => void>

  beforeEach(() => {
    mode = 'browser'
    listeners = new Set()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('steamx:pwa-visit-count', '1')
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return query === `(display-mode: ${mode})` },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(['fullscreen', 'standalone'])('does not offer installation when launched in %s', (displayMode) => {
    mode = displayMode
    render(<PwaInstallPrompt />)
    fireEvent(window, new Event('beforeinstallprompt', { cancelable: true }))
    expect(screen.queryByRole('button', { name: '关闭安装提示' })).toBeNull()
  })

  it('removes an existing prompt on fullscreen entry and rejects later install events', () => {
    const { unmount } = render(<PwaInstallPrompt />)
    fireEvent(window, new Event('beforeinstallprompt', { cancelable: true }))
    expect(screen.getByRole('button', { name: '关闭安装提示' })).toBeInTheDocument()
    act(() => { mode = 'fullscreen'; listeners.forEach((listener) => listener()) })
    expect(screen.queryByRole('button', { name: '关闭安装提示' })).toBeNull()
    fireEvent(window, new Event('beforeinstallprompt', { cancelable: true }))
    expect(screen.queryByRole('button', { name: '关闭安装提示' })).toBeNull()
    unmount()
    expect(listeners.size).toBe(0)
  })
})

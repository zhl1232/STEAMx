import { describe, expect, it } from 'vitest'

import {
  detectInAppBrowser,
  detectIosSafari,
  isPwaInstallCooldownActive,
  PWA_INSTALL_COOLDOWN_MS,
  PWA_INSTALL_DISMISS_KEY,
  writePwaInstallDismissedAt,
} from './install'

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value
    },
  }
}

describe('detectInAppBrowser', () => {
  it('detects WeChat and QQ in-app browsers', () => {
    expect(detectInAppBrowser('Mozilla/5.0 MicroMessenger/8.0.0')).toBe(true)
    expect(detectInAppBrowser('Mozilla/5.0 QQ/9.0.0')).toBe(true)
    expect(detectInAppBrowser('Mozilla/5.0 Chrome/120.0.0.0 Mobile Safari/537.36')).toBe(false)
  })
})

describe('detectIosSafari', () => {
  it('detects Safari on iPhone and rejects Chrome on iOS', () => {
    expect(
      detectIosSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)

    expect(
      detectIosSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false)
  })
})

describe('isPwaInstallCooldownActive', () => {
  it('honors the 14-day dismiss cooldown', () => {
    const storage = memoryStorage()
    const now = 1_700_000_000_000
    writePwaInstallDismissedAt(now - 1000, storage)
    expect(isPwaInstallCooldownActive(now, storage)).toBe(true)

    writePwaInstallDismissedAt(now - PWA_INSTALL_COOLDOWN_MS - 1, storage)
    expect(isPwaInstallCooldownActive(now, storage)).toBe(false)
    expect(storage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe(String(now - PWA_INSTALL_COOLDOWN_MS - 1))
  })
})

describe('pwa prompt eligibility', async () => {
  const { isPwaPromptEligible, isPwaBlockedPath } = await import('./install')
  it('blocks login and lesson pages', () => {
    expect(isPwaBlockedPath('/login')).toBe(true)
    expect(isPwaBlockedPath('/courses/5/lessons/30')).toBe(true)
    expect(isPwaBlockedPath('/courses/5')).toBe(false)
  })
  it('needs login plus a finished lesson or a second visit', () => {
    const base = { loggedIn: true, pathname: '/explore', visitCount: 1, lessonCompleted: false }
    expect(isPwaPromptEligible(base)).toBe(false)
    expect(isPwaPromptEligible({ ...base, visitCount: 2 })).toBe(true)
    expect(isPwaPromptEligible({ ...base, lessonCompleted: true })).toBe(true)
    expect(isPwaPromptEligible({ ...base, loggedIn: false, visitCount: 3 })).toBe(false)
    expect(isPwaPromptEligible({ ...base, pathname: '/courses/5/lessons/30', visitCount: 3 })).toBe(false)
  })
})

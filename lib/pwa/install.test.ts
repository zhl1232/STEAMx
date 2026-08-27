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

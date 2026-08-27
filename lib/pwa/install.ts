export const PWA_INSTALL_DISMISS_KEY = 'steamx-pwa-install-dismissed-at'
export const PWA_INSTALL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export function readPwaInstallDismissedAt(storage: Pick<Storage, 'getItem'> = localStorage): number | null {
  try {
    const raw = storage.getItem(PWA_INSTALL_DISMISS_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export function isPwaInstallCooldownActive(
  now = Date.now(),
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  const dismissedAt = readPwaInstallDismissedAt(storage ?? localStorage)
  if (dismissedAt == null) return false
  return now - dismissedAt < PWA_INSTALL_COOLDOWN_MS
}

export function writePwaInstallDismissedAt(
  at = Date.now(),
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(PWA_INSTALL_DISMISS_KEY, String(at))
  } catch {
    // ignore quota / private mode
  }
}

export function detectInAppBrowser(userAgent: string): boolean {
  return /MicroMessenger|QQ\//i.test(userAgent)
}

export function detectIosSafari(
  userAgent: string,
  options?: { platform?: string; maxTouchPoints?: number },
): boolean {
  const platform = options?.platform ?? ''
  const maxTouchPoints = options?.maxTouchPoints ?? 0
  const isIos =
    /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  if (!isIos) return false
  if (detectInAppBrowser(userAgent)) return false
  // Chrome/Firefox/Edge on iOS include CriOS/FxiOS/EdgiOS; native Safari does not.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(userAgent)) return false
  return /Safari/i.test(userAgent)
}

export function isStandaloneDisplay(win: Window = window): boolean {
  if (win.matchMedia('(display-mode: standalone)').matches) return true
  const nav = win.navigator as Navigator & { standalone?: boolean }
  return Boolean(nav.standalone)
}

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

/* ── 什么时候才弹「安装到桌面」 ──
 * 登录页、课时学习页不弹（会挡住「下一页」）；
 * 必须已登录，且完成过一节课或已经是第二次来访。 */
const PWA_VISIT_COUNT_KEY = 'steamx:pwa-visit-count'
const PWA_VISIT_SESSION_KEY = 'steamx:pwa-visit-counted'
const PWA_LESSON_DONE_KEY = 'steamx:pwa-lesson-completed'
export const PWA_ELIGIBILITY_EVENT = 'steamx:pwa-eligibility'

function safeLocal(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** 每个浏览器会话只记一次访问，返回累计访问次数。 */
export function recordPwaVisit(): number {
  const local = safeLocal()
  if (!local) return 0
  try {
    const current = Number(local.getItem(PWA_VISIT_COUNT_KEY)) || 0
    if (window.sessionStorage.getItem(PWA_VISIT_SESSION_KEY)) return current
    window.sessionStorage.setItem(PWA_VISIT_SESSION_KEY, '1')
    local.setItem(PWA_VISIT_COUNT_KEY, String(current + 1))
    return current + 1
  } catch {
    return 0
  }
}

export function markPwaLessonCompleted() {
  try {
    safeLocal()?.setItem(PWA_LESSON_DONE_KEY, '1')
    window.dispatchEvent(new Event(PWA_ELIGIBILITY_EVENT))
  } catch {
    // ignore
  }
}

export function hasCompletedLessonForPwa(): boolean {
  return safeLocal()?.getItem(PWA_LESSON_DONE_KEY) === '1'
}

export function isPwaBlockedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === '/login' || pathname.startsWith('/login/') || pathname.startsWith('/auth/')) return true
  return /^\/courses\/[^/]+\/lessons\//.test(pathname)
}

export function isPwaPromptEligible(args: {
  loggedIn: boolean
  pathname: string | null | undefined
  visitCount: number
  lessonCompleted: boolean
}): boolean {
  if (!args.loggedIn) return false
  if (isPwaBlockedPath(args.pathname)) return false
  return args.lessonCompleted || args.visitCount >= 2
}

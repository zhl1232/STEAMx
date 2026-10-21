/**
 * 未登录用户的登录引导节奏（替代原来的首次访问自动弹登录）：
 * - 看到第 2 个页面或停留约 30 秒后，底部轻弹一次；
 * - 关掉后当天不再弹；学习页/课件页不弹，免得挡住「下一页」。
 */
const PAGE_VIEW_KEY = 'steamx:login-nudge:views'
const DISMISS_DAY_KEY = 'steamx:login-nudge:dismissed-day'
export const LOGIN_NUDGE_DELAY_MS = 30_000
export const LOGIN_NUDGE_MIN_PAGE_VIEWS = 2

export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now)
}

const LAST_PATH_KEY = 'steamx:login-nudge:last-path'

/** 记一次页面浏览；同一路径重复渲染（StrictMode、登录状态变化）不重复计数。 */
export function recordLoginNudgePageView(pathname: string): number {
  try {
    const current = Number(sessionStorage.getItem(PAGE_VIEW_KEY)) || 0
    if (sessionStorage.getItem(LAST_PATH_KEY) === pathname) return current
    sessionStorage.setItem(LAST_PATH_KEY, pathname)
    sessionStorage.setItem(PAGE_VIEW_KEY, String(current + 1))
    return current + 1
  } catch {
    return 0
  }
}

export function isLoginNudgeDismissedToday(now = new Date()): boolean {
  try {
    return localStorage.getItem(DISMISS_DAY_KEY) === todayKey(now)
  } catch {
    return false
  }
}

export function dismissLoginNudgeForToday(now = new Date()) {
  try {
    localStorage.setItem(DISMISS_DAY_KEY, todayKey(now))
  } catch {
    // ignore
  }
}

export function isLoginNudgeBlockedPath(pathname: string): boolean {
  return /^\/courses\/[^/]+\/lessons\//.test(pathname) || /^\/playground\/.+/.test(pathname)
}

export type LoginPromptSource = 'banner' | 'action' | 'delayed'
export type LoginPromptStage = 'show' | 'click' | 'login' | 'signup'

/**
 * 统计埋点占位：项目目前没有统计系统，这里只派发一个浏览器事件，
 * 以后接入统计时监听 `steamx:analytics` 即可，不写数据库。
 */
export function trackLoginPrompt(source: LoginPromptSource, stage: LoginPromptStage) {
  try {
    window.dispatchEvent(new CustomEvent('steamx:analytics', { detail: { event: 'login_prompt', source, stage } }))
  } catch {
    // ignore
  }
}

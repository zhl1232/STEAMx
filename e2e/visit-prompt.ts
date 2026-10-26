import type { Page } from '@playwright/test'

/** 页面浏览由客户端 effect 记录；等待它完成，避免操作尚未绑定事件的 SSR 控件。 */
export async function waitForRecordedPageView(page: Page, pathname: string) {
  await page.waitForFunction((expectedPath) =>
    sessionStorage.getItem('steamx:login-nudge:last-path') === expectedPath,
  pathname)
}

/** 未登录看到第 2 个页面或停留 30 秒会轻弹一次登录层；只测页面本身的用例先标记为「今天已关闭」。 */
export async function skipVisitLoginPrompt(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('steamx:visit-prompt:v1', '1')
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
      localStorage.setItem('steamx:login-nudge:dismissed-day', today)
    } catch { /* ignore */ }
  })
}

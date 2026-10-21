import type { Page } from '@playwright/test'

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

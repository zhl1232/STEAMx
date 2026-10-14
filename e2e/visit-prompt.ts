import type { Page } from '@playwright/test'

/** 首次访问会自动弹登录层（每个标签页一次）；只测页面本身的用例先标记为已提示。 */
export async function skipVisitLoginPrompt(page: Page) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('steamx:visit-prompt:v1', '1') } catch { /* ignore */ }
  })
}

import { expect, test, type Page } from '@playwright/test'

async function expectHealthyPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBeLessThan(500)
  await expect(page.locator('body')).not.toContainText('Application error')
}

test('首页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/')
  await expect(page).toHaveTitle(/STEAM Explore & Share/)
})

test('探索页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/explore')
})

test('未登录访问商店会跳转到登录页', async ({ page }) => {
  await page.goto('/shop', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).not.toContainText('Application error')
})

import { expect, test, type Page } from '@playwright/test'

async function expectHealthyPage(page: Page, path: string) {
  const pageErrors: string[] = []
  const onPageError = (error: Error) => {
    pageErrors.push(error.message)
  }

  page.on('pageerror', onPageError)
  try {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText('Application error')
    expect(pageErrors).toEqual([])
  } finally {
    page.off('pageerror', onPageError)
  }
}

test('首页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/')
  await expect(page).toHaveTitle(/STEAM 项目式学习与自然观察社区/)
})

test('探索页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/explore')
})

test('自然观察页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/nature')
  await expect(page.getByRole('heading', { name: '自然观察' }).first()).toBeVisible()
})

test('创造营 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/create')
  await expect(page.getByRole('tab', { name: '项目挑战' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '技能课程' })).toBeVisible()
})

test('技能课程页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/courses')
  await expect(page.getByRole('heading', { name: '技能课程' }).first()).toBeVisible()
})

test('游乐场页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/playground')
  await expect(page.getByRole('heading', { name: /STEAM Playground/ })).toBeVisible()
})

test('联网竞速登录链接保留邀请房间码', async ({ page }) => {
  await page.goto('/playground/24game?room=ABC123', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: '去登录' }).click()
  await expect(page).toHaveURL(/\/login\?next=/)

  const loginUrl = new URL(page.url())
  expect(loginUrl.searchParams.get('next')).toBe('/playground/24game?room=ABC123')
})

test('登录页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/login')
  await expect(page.getByRole('heading', { name: '回到你的探索档案' })).toBeVisible()
})

test('移动端自然观察页 smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/nature')
  await expect(page.getByText('发布观察').first()).toBeVisible()
})

test('未登录访问商店会跳转到登录页', async ({ page }) => {
  await page.goto('/shop', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).not.toContainText('Application error')
})

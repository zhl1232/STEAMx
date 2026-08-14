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

test('项目挑战页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/create')
  await expect(page.getByRole('heading', { name: '项目挑战' }).first()).toBeVisible()
})

test('课程列表只有 /courses 一个入口', async ({ page }) => {
  await page.goto('/create?tab=courses', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/courses$/)
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
  await expect(page.getByRole('heading', { name: '登录 / 注册' })).toBeVisible()
})

test('登录页移动端聚焦表单', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/login')
  await expect(page.getByRole('heading', { name: '登录 / 注册' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '回到你的探索档案' })).toBeHidden()
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

// 详情页一旦有 loading.tsx，Suspense 会先把外壳连同 200 冲出去，后面再调 notFound()
// 就只换 UI 不改状态码，内容删掉后仍然是可索引的“软 404”。
for (const missing of [
  '/project/999999',
  '/nature/observations/999999',
  '/nature/species/no-such-slug',
]) {
  test(`${missing} 返回真正的 404 状态码`, async ({ page }) => {
    const response = await page.goto(missing, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
}

// 受登录保护的分区不能只回跳到分区首页，否则从通知/分享点进来的深链接登录后会走丢。
const protectedDeepLinks = [
  ['/profile/timeline', '/profile/timeline'],
  ['/profile/followers', '/profile/followers'],
  ['/messages/11111111-1111-1111-1111-111111111111', '/messages/11111111-1111-1111-1111-111111111111'],
  ['/share?edit=42', '/share?edit=42'],
  ['/coins', '/coins'],
] as const

for (const [target, expectedNext] of protectedDeepLinks) {
  test(`未登录访问 ${target} 会带上完整回跳地址`, async ({ page }) => {
    await page.goto(target, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login\?next=/)
    expect(new URL(page.url()).searchParams.get('next')).toBe(expectedNext)
  })
}

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
  await expect(page).toHaveTitle('创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程')
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
  await expect(page.getByRole('heading', { name: '手机号登录' })).toBeVisible()
})

test('登录页移动端聚焦表单', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/login')
  await expect(page.getByRole('heading', { name: '手机号登录' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '回到你的探索档案' })).toBeHidden()
})

test('手机验证码登录保持两步表单和重发倒计时', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let sentCount = 0
  await page.route('**/api/auth/sms/send', (route) => {
    sentCount += 1
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/login')
  // The controlled Radix checkbox confirms hydration before typing into SSR inputs.
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByLabel('手机号', { exact: true }).fill('13800138000')
  await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('13800138000')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await expect(page.getByRole('heading', { name: '输入验证码' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /s 后重发/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '验证并继续' })).toBeDisabled()
  await page.getByLabel('验证码', { exact: true }).fill('123456')
  await expect(page.getByRole('button', { name: '验证并继续' })).toBeEnabled()
  await page.getByRole('button', { name: '修改手机号' }).click()
  await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('13800138000')
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByRole('button', { name: /s 后重新获取/ })).toBeDisabled()
  expect(sentCount).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
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

// Disable page JavaScript so these assertions cover the actual nested SSR output,
// including metadata inheritance, without relying on hydration to repair it.
for (const route of [
  { path: '/playground/minesweeper', name: '扫雷 在线逻辑推理游戏', crumbs: ['首页', '游乐场', '扫雷'] },
  { path: '/playground/minesweeper/course', name: '扫雷解局学 入门教程', crumbs: ['首页', '游乐场', '扫雷', '扫雷解局学'] },
]) {
  test(`${route.path} SSR 页面身份一致`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
    try {
      const page = await context.newPage()
      const response = await page.goto(route.path)
      expect(response?.status()).toBe(200)
      const canonical = page.locator('link[rel="canonical"]')
      await expect(canonical).toHaveCount(1)
      const expectedUrl = `https://steam.bj.cn${route.path}`
      await expect(canonical).toHaveAttribute('href', expectedUrl)
      const entities = await page.locator('script[type="application/ld+json"]').evaluateAll(
        (scripts) => scripts.flatMap((script) => {
          const data = JSON.parse(script.textContent || 'null')
          return Array.isArray(data) ? data : data['@graph'] ?? [data]
        }),
      )
      const webPages = entities.filter((entity) => entity['@type'] === 'WebPage')
      expect(webPages).toHaveLength(1)
      expect(webPages[0]).toMatchObject({
        '@id': `${expectedUrl}#webpage`,
        url: expectedUrl,
        name: route.name,
        isPartOf: { name: '创探空间' },
        about: { '@type': 'Game', name: '扫雷', url: 'https://steam.bj.cn/playground/minesweeper' },
      })
      const breadcrumbs = entities.filter((entity) => entity['@type'] === 'BreadcrumbList')
      expect(breadcrumbs).toHaveLength(1)
      expect(breadcrumbs[0].itemListElement).toEqual(route.crumbs.map((name, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: ['https://steam.bj.cn/', 'https://steam.bj.cn/playground',
          'https://steam.bj.cn/playground/minesweeper',
          'https://steam.bj.cn/playground/minesweeper/course'][index],
      })))
    } finally {
      await context.close()
    }
  })
}

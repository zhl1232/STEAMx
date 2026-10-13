import { expect, test, type Page } from '@playwright/test'

const announcement = {
  id: 41,
  title: '春季创作周开始了',
  summary: '选择一个方向，完成你的第一段探索。',
  body: '## 从一个问题开始\n\n- 先观察\n- 再动手\n\n[进入探索](/explore)\n\n<script>alert("unsafe")</script>',
  level: 'important',
  status: 'published',
  action_label: '开始探索',
  action_href: '/explore',
  published_at: '2026-09-21T08:00:00.000Z',
  expires_at: null,
  created_at: '2026-09-21T08:00:00.000Z',
  updated_at: '2026-09-21T08:00:00.000Z',
}

const withdrawn = {
  id: 42,
  title: '已撤回的公告',
  summary: '这段摘要不应在详情中出现。',
  body: '这段正文不应被渲染。',
  level: 'normal',
  status: 'withdrawn',
  action_label: '危险入口',
  action_href: '/admin',
  published_at: '2026-09-20T08:00:00.000Z',
  expires_at: null,
  created_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
}

async function mockCommunications(page: Page) {
  await page.route('**/api/announcements/active', (route) =>
    route.fulfill({ json: { announcements: [announcement] } }),
  )
  await page.route('**/api/announcements', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ json: { announcements: [announcement, { id: withdrawn.id, status: 'withdrawn' }] } })
  })
  await page.route('**/api/announcements/41', (route) =>
    route.fulfill({ json: { announcement } }),
  )
  await page.route('**/api/announcements/42', (route) =>
    route.fulfill({ json: { announcement: { id: withdrawn.id, status: 'withdrawn' } } }),
  )
  await page.route('**/api/announcements/*/state', (route) =>
    route.fulfill({ json: { claimed: false, ok: true } }),
  )
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

for (const viewport of [
  { name: '320', width: 320, height: 760 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test(`探索指南在 ${viewport.name} 视口保留四个方向入口且无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mockCommunications(page)
    await page.goto('/start', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: '今天想和孩子做点什么？' })).toBeVisible()
    const destinations = [
      ['/courses?category=brick', '搭积木'],
      ['/explore?category=科学', '做小实验'],
      ['/courses?category=programming', '学编程'],
      ['/nature', '去自然里观察'],
    ] as const
    const nav = page.getByRole('navigation', { name: '选择开始方向' })
    for (const [href, label] of destinations) {
      const destination = nav.getByRole('link', { name: new RegExp(label) })
      await expect(destination).toHaveCount(1)
      await expect(destination).toHaveAttribute('href', href)
    }
    await expect(page.locator('main a[href="/learn/nature#first-try"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '先随便看看' })).toHaveAttribute('href', '/explore')
    await expect(page.getByRole('link', { name: '联系客服' })).toHaveAttribute('href', '/about#support')
    await expect(page.locator('main a')).toHaveCount(6) // 四个方向、先随便看看、联系客服
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `/tmp/platform-start-${viewport.name}.png`, fullPage: true })
  })
}

test('公告列表、详情和撤回状态使用安全的渲染结果', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCommunications(page)
  await page.goto('/announcements', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: '公告' })).toBeVisible()
  await expect(page.getByRole('heading', { name: announcement.title })).toBeVisible()
  // The public list intentionally redacts withdrawn rows to { id, status }.
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByText('已撤回的公告')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: '/tmp/platform-announcements-list.png', fullPage: true })

  await page.getByRole('link', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/announcements\/41$/)
  await expect(page.getByRole('heading', { name: '从一个问题开始' })).toBeVisible()
  await expect(page.locator('.prose script')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '开始探索' })).toHaveAttribute('href', '/explore')
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: '/tmp/platform-announcement-detail.png', fullPage: true })

  await page.goto('/announcements/42', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('这条公告已撤回，正文和操作入口已不可用。')).toBeVisible()
  await expect(page.getByText(withdrawn.body)).toHaveCount(0)
  await expect(page.getByRole('link', { name: withdrawn.action_label })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

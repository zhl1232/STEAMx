import { expect, test } from '@playwright/test'
import { skipVisitLoginPrompt, waitForRecordedPageView } from './visit-prompt'

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.startsWith('首次访问')) await skipVisitLoginPrompt(page)
})

for (const width of [320, 390, 768, 1280, 1840]) {
  test(`自然观察指引 ${width}：先行动，详细说明可用键盘展开`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/learn/nature', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: '自然观察入门' })).toBeVisible()
    await expect(page.locator('details[open]')).toHaveCount(0)
    await expect(page.locator('#first-try')).toBeVisible()
    await expect(page.locator('#first-try ol > li')).toHaveCount(3)
    await expect(page.locator('#observation-boundaries')).toContainText('不追赶、不投喂、不采摘')
    await expect(page.locator('#start-learning')).toContainText('位置不要精确公开')
    await expect(page.locator('#start-learning a[href="/nature/submit"]')).toBeVisible()
    const disclosure = page.locator('#record-observation')
    const summary = disclosure.locator('summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(disclosure).toHaveAttribute('open', '')
    await expect(disclosure).toContainText('每张照片会成为一条独立观察')
    await page.keyboard.press('Enter')
    await expect(disclosure).not.toHaveAttribute('open', '')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('原有自然观察操作说明深链接直接展开并定位', async ({ page }) => {
  await page.goto('/learn/nature#record-observation')
  const disclosure = page.locator('#record-observation')
  await expect(disclosure).toHaveAttribute('open', '')
  await expect(disclosure.locator('summary')).toBeInViewport()
  await expect(disclosure.getByText('逐张确认物种、时间和地点', { exact: true })).toBeVisible()
  await page.evaluate(() => { location.hash = 'observation-avoid' })
  const rules = page.locator('details').filter({ has: page.locator('#observation-avoid') })
  await expect(rules).toHaveAttribute('open', '')
  await expect(page.locator('#observation-avoid')).toBeInViewport()
})

test('learn 总入口兼容到 /start，四个方向入口可直接进入内容', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/learn')
  await expect(page).toHaveURL(/\/start$/)
  await expect(page.getByRole('heading', { level: 1, name: '今天想和孩子做点什么？' })).toBeVisible()
  await expect(page.locator('main a[href="/learn/nature#first-try"]')).toHaveCount(0)
  const destinations = [
    ['/courses?category=brick', '搭积木'],
    ['/explore?category=科学', '做小实验'],
    ['/courses?category=programming', '学编程'],
    ['/nature', '去自然里观察'],
  ] as const
  for (const [href, label] of destinations) {
    const link = page.getByRole('navigation', { name: '选择开始方向' }).getByRole('link', { name: new RegExp(label) })
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('href', href)
  }
  const nature = page.getByRole('navigation', { name: '选择开始方向' }).getByRole('link', { name: /去自然里观察/ })
  await expect(nature).toBeInViewport()
  await waitForRecordedPageView(page, '/start')
  await nature.click()
  await page.waitForURL(/\/nature\/?$/)
  await expect(page).toHaveURL(/\/nature\/?$/)
})

test('无 JavaScript 时仍有可展开正文和真实链接', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('/learn/nature')
    const disclosure = page.locator('#record-observation')
    await disclosure.locator('summary').click()
    await expect(disclosure).toHaveAttribute('open', '')
    await expect(disclosure.getByText('逐张确认物种、时间和地点', { exact: true })).toBeVisible()
    await expect(page.locator('#start-learning a[href="/nature/submit"]')).toHaveAttribute('href', '/nature/submit')
  } finally { await context.close() }
})

for (const width of [390, 1280]) {
  test(`科学指引 ${width}：入口由项目承接，纸桥只作方法示例`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/learn/science#first-try', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: '科学实验' })).toBeVisible()
    await expect(page.locator('#first-try-heading')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '先试试纸桥' })).toHaveCount(0)
    await expect(page.locator('article header')).not.toContainText('纸桥')
    await expect(page.locator('#start-learning #first-try')).toHaveCount(1)
    const resources = page.locator('#start-learning')
    await expect(resources).toContainText('由成人承担相应操作')
    const cards = resources.locator('a[href^="/project/"]')
    if (await cards.count()) {
      await expect(page.locator('article header a')).toHaveAttribute('href', '#start-learning')
      await expect(page.locator('article header a')).toContainText('选择一个科学项目')
      await expect(cards.first()).toBeVisible()
      for (const card of await cards.all()) {
        expect(await card.getAttribute('href')).toMatch(/^\/project\/[^/?#]+$/)
      }
    } else {
      await expect(resources).toContainText('暂时没有可展示的科学项目')
      await expect(page.locator('article header a')).toHaveCount(0)
      await expect(resources.getByRole('link', { name: '去探索其他项目' })).toHaveAttribute('href', '/explore')
    }
    const method = page.locator('details').filter({ has: page.locator('#learning-method') })
    await expect(method).not.toHaveAttribute('open', '')
    await method.locator('summary').click()
    await expect(method.getByText(/方法示例（非站内项目）/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

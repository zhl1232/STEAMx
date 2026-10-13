import { expect, test } from '@playwright/test'

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

test('learn 总入口兼容到唯一探索指南，并可直接开始推荐活动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/learn')
  await expect(page).toHaveURL(/\/start$/)
  const start = page.locator('main a[href="/learn/nature#first-try"]')
  await expect(start).toBeInViewport()
  await start.click()
  await expect(page).toHaveURL(/\/learn\/nature#first-try$/)
  await expect(page.locator('#first-try')).toBeInViewport()
  await expect(page.locator('#observation-boundaries')).toBeVisible()
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

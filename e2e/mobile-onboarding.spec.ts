import { expect, test } from '@playwright/test'

// Isolated visitor tests: no registration, SMS, feedback submission or database writes.
test.use({ storageState: { cookies: [], origins: [] } })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/announcements/active', route => route.fulfill({ json: { announcements: [] } }))
})

for (const width of [360, 390, 430]) {
  test(`start choices fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/start')
    const nav = page.getByRole('navigation', { name: '选择开始方向' })
    await expect(nav.getByRole('link')).toHaveCount(4)
    await expect(page.getByText('开始这次观察', { exact: true })).toHaveCount(0)
    for (const link of await nav.getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(nav.getByRole('link', { name: /搭积木/ })).toHaveAttribute('href', '/courses?category=brick')
    await expect(nav.getByRole('link', { name: /学编程/ })).toHaveAttribute('href', '/courses?category=programming')
    await expect(nav.getByRole('link', { name: /去自然里观察/ })).toHaveAttribute('href', '/nature')
  })
}

for (const href of ['/about#support', '/about#contact', '/settings/about#contact']) {
  test(`support link lands before the official account: ${href}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(href)
    await expect(page.locator('#support-heading')).toBeInViewport()
    await expect(page.locator('#feedback')).toBeVisible()
    const support = page.locator('#support')
    await expect(support.getByText('微信客服', { exact: true })).toBeVisible()
    await expect(support.locator('img[src*="contact-official-account"]')).toHaveCount(0)
    await expect(page.locator('#official-account details')).not.toHaveAttribute('open', '')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

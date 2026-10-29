import { expect, test, type Locator, type Page } from '@playwright/test'
import { skipVisitLoginPrompt, waitForRecordedPageView } from './visit-prompt'

const viewports = [
  [320, 740, 2], [375, 812, 2], [390, 844, 2], [430, 932, 2],
  [768, 1024, 2], [820, 1180, 2], [1024, 768, 3], [1180, 820, 3],
  [1280, 800, 4], [1440, 900, 4], [1920, 1080, 4],
] as const

test.beforeEach(async ({ page }) => skipVisitLoginPrompt(page))

async function openExplore(page: Page) {
  await page.goto('/explore', { waitUntil: 'domcontentloaded' })
  await waitForRecordedPageView(page, '/explore')
  await expect(page.getByTestId('explore-project-grid')).toBeVisible()
}

async function expectInsideViewport(control: Locator, page: Page) {
  await expect(control).toBeVisible()
  const box = await control.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
}

for (const [width, height, columns] of viewports) {
  test(`探索页 ${width}×${height} 布局、筛选操作及焦点恢复`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await openExplore(page)
    const grid = page.getByTestId('explore-project-grid')
    await expect.poll(() => grid.evaluate(node => {
      return getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length
    })).toBe(columns)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    const mobile = width < 768
    const trigger = page.getByTestId(mobile ? 'explore-mobile-filters' : 'explore-desktop-filters')
    await expectInsideViewport(trigger, page)
    if (mobile) {
      const search = page.getByTestId('mobile-search-entry')
      await expectInsideViewport(search, page)
      const searchBox = (await search.boundingBox())!
      const filterBox = (await trigger.boundingBox())!
      expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(filterBox.x)
      expect(searchBox.height).toBeGreaterThanOrEqual(44)
      expect(filterBox.height).toBeGreaterThanOrEqual(44)
    }
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '筛选项目' })
    await expect(dialog).toBeVisible()
    // Wait for the drawer transform before inspecting its final screen bounds.
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.x)).toBe(mobile ? 0 : width - 440)
    await expectInsideViewport(dialog, page)
    await expectInsideViewport(dialog.getByRole('button', { name: '取消', exact: true }), page)
    await expectInsideViewport(dialog.getByRole('button', { name: '查看结果', exact: true }), page)
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
}

for (const [width, height] of [[390, 844], [820, 1180]] as const) {
  test(`探索页暗色 ${width}×${height} 筛选按钮可达`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width, height })
    await openExplore(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByTestId(width < 768 ? 'explore-mobile-filters' : 'explore-desktop-filters').click()
    const dialog = page.getByRole('dialog')
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.x)).toBe(width < 768 ? 0 : width - 440)
    await expectInsideViewport(dialog.getByRole('button', { name: '查看结果', exact: true }), page)
  })
}

test('手机搜索打开后切换到平板横屏仍可操作并恢复背景交互', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openExplore(page)
  await page.getByTestId('mobile-search-entry').click()
  const dialog = page.getByRole('dialog', { name: '搜索项目' })
  await expect(dialog.getByRole('searchbox')).toBeFocused()
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.height)).toBe(768)
  await expectInsideViewport(dialog, page)
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none')
  await page.getByTestId('explore-desktop-filters').click()
  await expect(page.getByRole('dialog', { name: '筛选项目' })).toBeVisible()
})

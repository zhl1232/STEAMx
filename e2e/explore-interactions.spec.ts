import { expect, test, type Page } from '@playwright/test'

const searchPlaceholder = '搜索项目、材料、作者...'

async function waitForExplore(page: Page) {
  await page.goto('/explore')
  await expect(page.getByTestId('explore-project-grid')).toBeVisible()
}

async function mockProjectSearch(
  page: Page,
  delayForQuery?: (query: string) => number,
) {
  await page.route('**/api/projects?**', async (route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q') ?? ''
    const delay = delayForQuery?.(query) ?? 0
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    const response = await route.fetch()
    const data = await response.json()
    const sourceProjects = data.projects?.length ? data.projects : [{
      id: 'e2e-fallback',
      title: '测试项目',
      author: '测试作者',
      author_id: 'e2e-author',
      image: '',
      category: '科学',
      likes: 0,
    }]
    const projects = sourceProjects.map((project: Record<string, unknown>, index: number) => ({
      ...project,
      id: `e2e-${query || 'all'}-${index}`,
      title: query ? `搜索结果：${query}` : '清空后的项目',
    }))
    await route.fulfill({
      status: response.status(),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, projects, total: projects.length, hasMore: false }),
    })
  })
}

test('桌面端搜索可输入、按 Enter 提交并保持焦点语义', async ({ page }) => {
  await waitForExplore(page)
  const input = page.locator(`input[placeholder="${searchPlaceholder}"]:visible`).first()
  await input.fill('纸桥')
  await input.press('Enter')

  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('纸桥')
  await expect(input).toHaveValue('纸桥')
  await expect(page.getByTestId('explore-project-grid')).toBeVisible()
})

test.describe('移动端搜索清空与分类', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('清空搜索保留已选分类', async ({ page }) => {
    await page.goto('/explore?category=科学')
    await expect(page.getByTestId('explore-project-grid')).toBeVisible()

    const input = page.locator(`input[placeholder="${searchPlaceholder}"]:visible`).first()
    await input.fill('线圈')
    await input.press('Enter')
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('线圈')

    await page.getByRole('button', { name: '清空搜索' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull()
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('科学')
    await expect(input).toHaveValue('')
  })

  test('切换分类后分类按钮和结果列表可见', async ({ page }) => {
    await waitForExplore(page)
    const science = page.getByTestId('explore-category-strip').getByRole('button', { name: '科学', exact: true })
    await science.click()

    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('科学')
    await expect(science).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('explore-project-grid')).toBeVisible()
  })
})

test('延迟搜索返回时保留新的输入草稿，随后清空不会恢复旧查询', async ({ page }) => {
  await mockProjectSearch(page, (query) => query === '慢查询' ? 700 : 0)
  await waitForExplore(page)

  const input = page.locator(`input[placeholder="${searchPlaceholder}"]:visible`).first()
  const slowRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/projects' && url.searchParams.get('q') === '慢查询'
  })
  await input.fill('慢查询')
  await input.press('Enter')
  await slowRequest

  await input.fill('新草稿')
  await expect(input).toHaveValue('新草稿')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull()

  await expect(page.getByTestId('explore-project-grid')).toContainText('搜索结果：慢查询')
  await expect(input).toHaveValue('新草稿')

  await page.getByRole('button', { name: '清空搜索' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull()
  await expect(input).toHaveValue('')
  await expect(page.getByTestId('explore-project-grid')).toContainText('清空后的项目')
})

test.describe('筛选抽屉和响应式网格', () => {
  test('桌面筛选抽屉为右侧满高面板，取消后恢复触发按钮焦点', async ({ page }) => {
    await waitForExplore(page)
    const trigger = page.getByTestId('explore-desktop-filters')
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThan(700)
    expect(box!.width).toBeGreaterThanOrEqual(400)
    expect(box!.x + box!.width).toBeGreaterThan(1200)

    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('网格在手机为两列，在桌面扩展为至少三列', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await waitForExplore(page)
    const grid = page.getByTestId('explore-project-grid')
    await expect.poll(async () => grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length)).toBe(2)

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect.poll(async () => grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length)).toBe(3)

    await page.setViewportSize({ width: 1920, height: 1000 })
    await expect.poll(async () => grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length)).toBe(4)
  })
})

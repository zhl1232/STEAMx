import { expect, test } from '@playwright/test'
import { skipVisitLoginPrompt, waitForRecordedPageView } from './visit-prompt'

test.beforeEach(async ({ page }) => {
  await skipVisitLoginPrompt(page)
  await page.route('**/api/projects?**', route => route.fulfill({
    json: { projects: [], hasMore: false, total: 0 },
  }))
})

for (const width of [390, 1440]) {
  test(`主题、排序及精简筛选独立生效 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const initial = new URLSearchParams({ category: '科学', tags: '磁力', difficulty: 'beginner', age: '8', sortBy: 'latest' })
    await page.goto(`/explore?${initial}`, { waitUntil: 'domcontentloaded' })
    await waitForRecordedPageView(page, '/explore')
    const topics = page.getByRole('group', { name: '快捷主题' })
    const fun = topics.getByRole('button', { name: '趣味实验', exact: true })
    const sort = page.getByRole('combobox', { name: '项目排序' })
    await expect(sort).toHaveValue('latest')
    await expect(page.getByTestId('explore-filter-summary').getByRole('button', { name: /磁力/ })).toHaveCount(0)
    await fun.click()
    await expect.poll(() => new URL(page.url()).searchParams.get('tags')).toBe('趣味实验')
    await expect(fun).toHaveAttribute('aria-pressed', 'true')
    expect(new URL(page.url()).searchParams.get('difficulty')).toBe('beginner')
    await sort.selectOption('popular')
    await expect.poll(() => new URL(page.url()).searchParams.get('sortBy')).toBeNull()
    await expect(fun).toHaveAttribute('aria-pressed', 'true')

    await page.getByTestId(width < 768 ? 'explore-mobile-filters' : 'explore-desktop-filters').click()
    const dialog = page.getByRole('dialog', { name: '筛选项目' })
    await expect(dialog.getByText('标签', { exact: true })).toHaveCount(0)
    await expect(dialog.getByText('查看更多标签')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: '科学', exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: '重置', exact: true }).click()
    await dialog.getByRole('button', { name: '查看结果', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('difficulty')).toBeNull()
    expect(new URL(page.url()).searchParams.get('age')).toBeNull()
    expect(new URL(page.url()).searchParams.get('category')).toBe('科学')
    expect(new URL(page.url()).searchParams.get('tags')).toBe('趣味实验')

    await expect(page.getByTestId('explore-filter-summary')).toHaveCount(0)
    await page.evaluate(() => sessionStorage.removeItem('steamx:login-nudge:last-path'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForRecordedPageView(page, '/explore')
    await expect(fun).toHaveAttribute('aria-pressed', 'true')
    await expect(sort).toHaveValue('popular')
    await fun.click()
    await expect.poll(() => new URL(page.url()).searchParams.get('tags')).toBeNull()
    expect(new URL(page.url()).searchParams.get('category')).toBe('科学')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('材料主题保留原排序，退出后恢复', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/explore?sortBy=latest', { waitUntil: 'domcontentloaded' })
  await waitForRecordedPageView(page, '/explore')
  const theme = page.getByRole('group', { name: '快捷主题' }).getByRole('button', { name: '日常材料', exact: true })
  await theme.click()
  await expect.poll(() => new URL(page.url()).searchParams.get('tags')).toBe('日常材料')
  await expect(page.getByRole('combobox', { name: '项目排序' })).toHaveCount(0)
  await expect(page.getByText('材料优先', { exact: true })).toHaveCount(0)
  await theme.click()
  await expect.poll(() => new URL(page.url()).searchParams.get('tags')).toBeNull()
  await expect(page.getByRole('combobox', { name: '项目排序' })).toHaveValue('latest')
})

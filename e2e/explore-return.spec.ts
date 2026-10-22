import { expect, test } from '@playwright/test'
import { skipVisitLoginPrompt } from './visit-prompt'

test.beforeEach(async ({ page }) => skipVisitLoginPrompt(page))

test('浏览器从项目页返回时，第一页仍使用已选标签', async ({ page }) => {
  await page.goto('/explore')
  const cards = page.locator('[data-explore-project-id]')
  await expect(cards).toHaveCount(3)

  await page.getByRole('button', { name: '磁力', exact: true }).click()
  await expect(page).toHaveURL(/tags=/)
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toHaveAttribute('data-explore-project-id', '101')

  await cards.first().getByRole('link').first().click()
  await expect(page).toHaveURL(/\/project\/101$/)
  // Leave through the real App Router so browser back exercises cached RSC data.
  await page.locator('main').waitFor()
  await page.goBack()
  await expect(page).toHaveURL(/\/explore\?tags=/)
  await expect.poll(() => page.evaluate(() =>
    sessionStorage.getItem('explore-scroll-restore-v3'),
  )).toBeNull()

  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toHaveAttribute('data-explore-project-id', '101')
  await expect(page.getByRole('button', { name: '磁力', exact: true }).first()).toHaveClass(/filter-chip-active/)

  await page.evaluate(() => sessionStorage.clear())
  await page.goForward()
  await expect(page).toHaveURL(/\/project\/101$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/explore\?tags=/)
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toHaveAttribute('data-explore-project-id', '101')
})

test('返回已加载多页的筛选列表时，每一页都保留筛选结果', async ({ page }) => {
  await page.route('**/api/projects?**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('tags') !== '磁力') return route.continue()
    const response = await route.fetch()
    const data = await response.json()
    const pageIndex = Number(url.searchParams.get('page') ?? 0)
    const projects = Array.from({ length: pageIndex === 0 ? 12 : 1 }, (_, index) => ({
      ...data.projects[0],
      id: 201 + pageIndex * 12 + index,
      title: `磁力筛选第${pageIndex + 1}页项目${index + 1}`,
    }))
    await route.fulfill({ json: { ...data, projects, total: 13, hasMore: pageIndex === 0 } })
  })

  await page.goto('/explore')
  const cards = page.locator('[data-explore-project-id]')
  await expect(cards).toHaveCount(3)
  await page.getByRole('button', { name: '磁力', exact: true }).click()
  await expect(cards).toHaveCount(12)
  await cards.last().scrollIntoViewIfNeeded()
  await expect(cards).toHaveCount(13)
  await cards.last().getByRole('link').first().click()
  await expect(page).toHaveURL(/\/project\/213$/)
  await page.locator('main').waitFor()
  await page.goBack()
  await expect(page).toHaveURL(/\/explore\?tags=/)
  await expect(cards).toHaveCount(13)
  await expect(cards.first()).toHaveAttribute('data-explore-project-id', '201')
  await expect(cards.last()).toHaveAttribute('data-explore-project-id', '213')
  expect(await cards.evaluateAll((nodes) => nodes.map(node => node.getAttribute('data-explore-project-id'))))
    .toEqual(Array.from({ length: 13 }, (_, index) => String(201 + index)))
})

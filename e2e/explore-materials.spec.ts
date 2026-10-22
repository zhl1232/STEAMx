import { expect, test, type Page } from '@playwright/test'
import { skipVisitLoginPrompt } from './visit-prompt'

test.beforeEach(async ({ page }) => skipVisitLoginPrompt(page))

const materialsHref = `/explore?${new URLSearchParams({ tags: '日常材料' })}`
const cards = (page: Page) => page.locator('[data-explore-project-id]')
const order = (page: Page) => cards(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-explore-project-id')))

async function selectCommon(page: Page, names: string[]) {
  const common = page.getByRole('group', { name: '常见材料' })
  for (const name of names) await common.getByRole('button', { name, exact: true }).click()
}

async function selectMore(page: Page, names: string[]) {
  await page.getByRole('button', { name: '更多材料', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '选择家里已有的材料' })
  for (const name of names) await sheet.getByRole('button', { name, exact: true }).click()
  await sheet.getByRole('button', { name: '选好了，查看项目' }).click()
  await expect(sheet).not.toBeVisible()
}

test('默认按材料从少到多排列，材料卡片等高且与其他分组共用列宽', async ({ page }) => {
  await page.goto('/explore')
  await expect(cards(page)).toHaveCount(3)
  const ordinarySize = await cards(page).first().boundingBox()
  await page.getByRole('button', { name: '日常材料', exact: true }).click()
  await expect(cards(page)).toHaveCount(5)
  expect(await order(page)).toEqual(['102', '103', '738', '586', '1157'])
  await expect(cards(page).first()).toContainText('3 样材料')
  await expect(page.getByText('先从材料少的开始，也可以点选上方材料')).toHaveCount(0)
  await expect(page.getByText('点选上方材料来匹配')).toHaveCount(0)
  await expect(page.getByRole('list', { name: '所需材料' })).toHaveCount(0)
  const materialSize = await cards(page).first().boundingBox()
  expect(Math.abs(materialSize!.width - ordinarySize!.width)).toBeLessThanOrEqual(1)
  const heights = await cards(page).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: '热门推荐', exact: true }).click()
  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByTestId('household-material-picker')).toHaveCount(0)
  await expect(page.getByText(/^\d+ 样材料$/)).toHaveCount(0)
})

test('点选后优先展示最接近的项目，更多材料可配齐并支持取消、清空', async ({ page }) => {
  await page.goto(materialsHref)
  await selectCommon(page, ['纸巾', '清水', '水溶性彩笔'])
  const rainbow = page.locator('[data-explore-project-id="738"]')
  await expect(cards(page).first()).toHaveAttribute('data-explore-project-id', '738')
  await expect(rainbow).toContainText('需要 4 样，你有 3 样')
  await expect(rainbow).toContainText('还差：浅盘')
  await expect(page.locator('[data-explore-project-id="586"]')).toContainText('还差 5 样')
  await selectMore(page, ['浅盘'])
  await expect(rainbow).toContainText('材料已匹配')
  await expect(page.getByTestId('household-material-picker')).toContainText('1 个项目材料已匹配')
  await page.getByRole('button', { name: '移除浅盘' }).click()
  await expect(rainbow).toContainText('还差：浅盘')
  await page.getByRole('button', { name: '清空已选材料' }).click()
  expect(await order(page)).toEqual(['102', '103', '738', '586', '1157'])
  await expect(page.getByRole('group', { name: '常见材料' }).getByRole('button', { pressed: true })).toHaveCount(0)
})

test('匹配只计材料，绳子如何系牢放在详情准备要求里', async ({ page }) => {
  await page.goto(materialsHref)
  await selectCommon(page, ['气球', '直吸管'])
  await selectMore(page, ['细绳', '双面胶'])
  const balloon = page.locator('[data-explore-project-id="586"]')
  await expect(balloon).toContainText('需要 5 样，你有 4 样')
  await expect(balloon).toContainText('还差：剪刀')
  await selectMore(page, ['剪刀'])
  await expect(cards(page).first()).toHaveAttribute('data-explore-project-id', '586')
  await expect(balloon).toContainText('材料已匹配')
  await balloon.getByRole('link', { name: '查看项目：气球缆车' }).click()
  const desktopMaterials = page.locator('#project-materials')
  await expect(desktopMaterials.getByRole('heading', { name: '准备要求' })).toBeVisible()
  await expect(desktopMaterials).toContainText('两把稳固椅子的椅背')
  await expect(desktopMaterials.getByRole('listitem')).toHaveCount(6)
  await expect(desktopMaterials.getByRole('listitem').filter({ hasText: '固定点' })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileMaterials = page.locator('#project-materials-mobile')
  await expect(mobileMaterials.getByRole('heading', { name: '准备要求' })).toBeVisible()
  await expect(mobileMaterials).toContainText('两把稳固椅子的椅背')
})

test.describe('手机材料匹配', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('双列卡片、材料横滑，详情返回和刷新保留选择与排序', async ({ page }) => {
    await page.goto(materialsHref)
    await expect(cards(page)).toHaveCount(5)
    const grid = page.getByTestId('explore-project-grid')
    expect(await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2)
    const strip = page.getByTestId('common-materials-strip')
    expect(await strip.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
    const stripBounds = (await strip.boundingBox())!
    const moreBounds = (await page.getByRole('button', { name: '更多材料', exact: true }).boundingBox())!
    const pickerBounds = (await page.getByTestId('household-material-picker').boundingBox())!
    expect(moreBounds.y + moreBounds.height).toBeLessThanOrEqual(stripBounds.y)
    expect(Math.abs(stripBounds.width - pickerBounds.width)).toBeLessThanOrEqual(1)
    await page.mouse.move(stripBounds.x + stripBounds.width / 2, stripBounds.y + stripBounds.height / 2)
    await page.mouse.wheel(900, 0)
    await expect.poll(() => strip.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
    const flashlight = strip.getByRole('button', { name: '手机手电筒', exact: true })
    await flashlight.click()
    await expect(flashlight).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await flashlight.click()
    await selectCommon(page, ['纸巾', '清水', '水溶性彩笔'])
    await selectMore(page, ['浅盘'])
    const rainbow = page.locator('[data-explore-project-id="738"]')
    await rainbow.getByRole('link', { name: '查看项目：彩虹爬爬爬' }).click()
    await expect(page).toHaveURL(/\/project\/738$/)
    await expect(page.locator('#project-materials-mobile')).toContainText('浅盘')
    await page.goBack()
    await expect(cards(page).first()).toHaveAttribute('data-explore-project-id', '738')
    await expect(rainbow).toContainText('材料已匹配')
    await page.reload()
    await expect(rainbow).toContainText('需要 4 样，你有 4 样')
    await expect(page.getByRole('group', { name: '常见材料' }).getByRole('button', { name: '纸巾', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('320px 暗色模式下未知清单不误判齐全，弹层与卡片无横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.route('**/api/projects?**', async (route) => {
      const response = await route.fetch()
      const data = await response.json()
      const sample = data.projects[0]
      await route.fulfill({ json: {
        projects: [
          { ...sample, id: 900001, title: '长材料名预览', materials: ['LongUnrecognizedMaterialNameForOverflowVerification1234567890'] },
          { ...sample, id: 900002, title: '待补充清单预览', materials: [] },
        ],
        hasMore: false,
        total: 2,
      } })
    })
    await page.goto('/explore')
    await page.getByRole('button', { name: '日常材料', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText('材料信息待核对')).toHaveCount(2)
    await selectCommon(page, ['纸巾'])
    await expect(cards(page).getByText('材料已匹配', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '更多材料', exact: true }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('button', { name: '带盖透明瓶', exact: true })).toHaveAccessibleDescription('透明塑料材质')
    await expect(sheet.getByRole('button', { name: '固定点', exact: true })).toHaveCount(0)
    expect(await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible()
    await expect(page.getByRole('button', { name: '更多材料', exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})

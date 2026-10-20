import { expect, test } from '@playwright/test'

const variants = ['default', 'mobile-compact', 'featured', 'adaptive', 'vertical', 'dense', 'explore']
for (const name of variants) {
  test(`${name}: full-card link, keyboard, context menu and sibling menu`, async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const section = page.getByTestId(name)
    const card = section.locator('.surface-card')
    const link = section.getByRole('link')
    await expect(link).toBeVisible({ timeout: 90000 })
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('href', '/project/42/records')
    await expect(link).toHaveAttribute('data-scroll', 'false')
    await expect(link).toHaveAttribute('data-prefetch', 'false')
    await expect(link).toContainText('会跑的小车')
    await expect(link.locator('mark')).toHaveText('小车')
    await expect(section.locator('h3 a')).toHaveCount(1)
    await expect(section.locator('a a, a button, a [tabindex]')).toHaveCount(0)
    await card.scrollIntoViewIfNeeded()
    const box = (await card.boundingBox())!
    // Native hit-testing, including image, padding and footer outside the title.
    for (const [x, y] of [[0.05, 0.05], [0.5, 0.2], [0.9, 0.5], [0.05, 0.95]]) {
      const point = { x: box.x + box.width * x, y: box.y + box.height * y }
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), point))
        .toBe('/project/42/records')
      await page.mouse.click(point.x, point.y)
      await expect(page.getByTestId('result')).toHaveText(`${name}:/project/42/records`)
    }
    await link.focus()
    await page.keyboard.press('Tab')
    await expect(section.getByRole('button', { name: `${name}菜单` })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(link).toBeFocused()
    expect(await card.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('result')).toHaveText(`${name}:/project/42/records`)
    await card.scrollIntoViewIfNeeded()
    const contextBox = (await card.boundingBox())!
    await page.mouse.click(contextBox.x + contextBox.width * 0.2, contextBox.y + contextBox.height * 0.2, { button: 'right' })
    await expect(page.getByTestId('result')).toContainText(`context:${name}:会跑的小车`)
    await page.keyboard.press('Escape')
    await section.getByRole('button', { name: `${name}菜单` }).click()
    await page.getByRole('menuitem', { name: '测试操作' }).click()
    await expect(page.getByTestId('result')).toHaveText(`menu:${name}`)
    await section.getByRole('button', { name: `${name}菜单` }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: '测试操作' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('result')).toHaveText(`menu:${name}`)
  })
}

import { test, expect, type Page } from '@playwright/test'

async function expectFullCanvas(page: Page) {
  await expect.poll(async () => {
    const rect = await page.getByLabel('3D 搭建图纸').boundingBox()
    return rect && [rect.x, rect.y, rect.width, rect.height].map(Math.round)
  }).toEqual([0, 0, page.viewportSize()!.width, page.viewportSize()!.height])
  await expect(page.getByTestId('build-parts-panel')).toBeHidden()
  await expect(page.getByRole('region', { name: '搭建操作' })).toHaveCount(0)
  await expect(page.getByText(/^课程 \d+\/\d+ 页$/)).toHaveCount(0)
  const exit = page.getByRole('button', { name: '关闭全屏' })
  await expect(exit).toBeVisible()
  const rect = await exit.boundingBox()
  expect(rect!.width).toBeGreaterThanOrEqual(44)
  expect(rect!.height).toBeGreaterThanOrEqual(44)
}

for (const mode of ['native', 'css-fallback'] as const) {
  test(`3D fills the viewport with opt-in controls and clean reentry: ${mode}`, async ({ page }, info) => {
    const mobile = info.project.name === 'mobile'
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1180, height: 757 })
    if (mode === 'css-fallback') {
      await page.addInitScript(() => {
        HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Isolated fullscreen rejection'))
      })
    }
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByText('正在加载 3D 图纸')).toBeHidden()
    await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(mode === 'native')
    await expectFullCanvas(page)
    await page.screenshot({ path: info.outputPath('01-full-canvas.png') })

    // Camera interaction stays on OrbitControls; there are no slide tap/swipe handlers on 3D.
    const camera = () => page.locator('canvas').evaluate((canvas: HTMLCanvasElement & { ldrawStats: () => { camera: number[] } }) => canvas.ldrawStats().camera)
    const beforeDrag = await camera()
    const { width, height } = page.viewportSize()!
    if (mobile) {
      const session = await page.context().newCDPSession(page)
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: height / 2 }] })
      for (let dx = 10; dx <= 80; dx += 10) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2 + dx, y: height / 2 + 20 }] })
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await session.detach()
    } else {
      await page.mouse.move(width / 2, height / 2)
      await page.mouse.down()
      await page.mouse.move(width / 2 + 80, height / 2 + 20, { steps: 8 })
      await page.mouse.up()
    }
    await expect.poll(camera).not.toEqual(beforeDrag)
    await expect(page.getByRole('region', { name: '搭建操作' })).toHaveCount(0)

    const toggle = page.getByRole('button', { name: '搭建操作', exact: true })
    await toggle.click()
    const controls = page.getByRole('region', { name: '搭建操作' })
    await expect(controls.getByText('1 / 30', { exact: true })).toBeVisible()
    await controls.getByRole('button', { name: '下一页' }).click()
    await expect(controls.getByText('2 / 30', { exact: true })).toBeVisible()
    await controls.getByRole('button', { name: /本步零件/ }).click()
    await expect(page.getByTestId('build-parts-panel')).toBeVisible()
    await expect(controls).toHaveCount(0)
    await expect(page.getByRole('button', { name: '收起零件' })).toBeFocused()
    await page.screenshot({ path: info.outputPath('02-parts-open.png') })

    // Leave while parts are open. External native exit and CSS Escape share cleanup.
    if (mode === 'native') await page.evaluate(() => document.exitFullscreen())
    else await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '关闭全屏' })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
    await expectFullCanvas(page)

    // Check rotation / breakpoint changes while fullscreen remains active.
    await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1024, height: 600 })
    await expectFullCanvas(page)
    await page.screenshot({ path: info.outputPath('03-rotated-or-resized.png') })
    await toggle.click()
    await page.getByRole('button', { name: '关闭全屏' }).click()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
    await expectFullCanvas(page)
    await page.getByRole('button', { name: '关闭全屏' }).click()
    if (mobile) await expect(page.getByText('拖动旋转 · 滚轮缩放')).toBeHidden()
    expect(errors).toEqual([])
  })
}

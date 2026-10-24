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

    // Camera interaction stays on OrbitControls; dragging must never become a page tap.
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
    await expect(page.getByTestId('fixture-step')).toHaveText('0')
    await expect(page.getByRole('region', { name: '搭建操作' })).toHaveCount(0)

    const toggle = page.getByRole('button', { name: '搭建操作', exact: true })
    await toggle.click()
    const controls = page.getByRole('region', { name: '搭建操作' })
    await expect(controls.getByText('1 / 30', { exact: true })).toBeVisible()
    await page.getByTestId('immersive-navigation').getByRole('button', { name: '下一页' }).click()
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

async function tapAt(page: Page, mobile: boolean, ratio: number) {
  const { width, height } = page.viewportSize()!
  if (mobile) await page.touchscreen.tap(width * ratio, height / 2)
  else await page.mouse.click(width * ratio, height / 2)
}

async function ready3D(page: Page) {
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('正在加载 3D 图纸')).toBeHidden()
}

test('edge taps, shared bottom buttons, boundaries and gesture isolation', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile'
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1180, height: 757 })
  let releaseModels!: () => void
  const modelsReady = new Promise<void>((resolve) => { releaseModels = resolve })
  await page.route('**/api/courses/ldraw-step?*', async (route) => {
    if (Number(new URL(route.request().url()).searchParams.get('step')) >= 1) await modelsReady
    await route.continue()
  })
  await page.goto('/')
  await ready3D(page)
  await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
  await expectFullCanvas(page)
  const step = page.getByTestId('fixture-step')
  const navigation = page.getByTestId('immersive-navigation')
  await tapAt(page, mobile, 0.1)
  await expect(step).toHaveText('0')
  // Separate rapid taps are intentional page changes, unlike image double-tap zoom.
  try {
    for (let n = 0; n < 3; n++) await tapAt(page, mobile, 0.9)
    await expect(step).toHaveText('3')
    // The informational loading veil must not swallow a subsequent tap.
    await expect(page.getByText('正在加载 3D 图纸')).toBeVisible()
  } finally {
    releaseModels()
  }
  await tapAt(page, mobile, 0.1)
  await expect(step).toHaveText('2')
  await ready3D(page)
  await tapAt(page, mobile, 0.5)
  await expect(navigation).toHaveAttribute('data-visible', 'true')
  const next = navigation.getByRole('button', { name: '下一页' })
  const rect = (await next.boundingBox())!
  expect(rect.height).toBeGreaterThanOrEqual(44)
  expect(rect.y).toBeGreaterThan(page.viewportSize()!.height - 100)
  await page.screenshot({ path: info.outputPath('04-shared-bottom-navigation.png') })
  await next.click()
  await expect(step).toHaveText('3')
  await expect(navigation).toHaveAttribute('data-visible', 'false', { timeout: 5000 })

  const { width, height } = page.viewportSize()!
  if (mobile) {
    const session = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', touchPoints: { x: number; y: number; id?: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
    const point = { x: width * 0.9, y: height / 2, id: 1 }
    // Real touch drag returning to the tap zone still must not navigate.
    await touch('touchStart', [point])
    await touch('touchMove', [{ ...point, x: width * 0.6 }])
    await touch('touchMove', [point])
    await touch('touchEnd', [])
    await expect(step).toHaveText('3')
    await touch('touchStart', [point])
    await page.waitForTimeout(400)
    await touch('touchEnd', [])
    await expect(step).toHaveText('3')
    // Pinch with the last finger released in the right page zone.
    await touch('touchStart', [point, { x: width * 0.4, y: height / 2, id: 2 }])
    await touch('touchMove', [{ ...point, x: width * 0.95 }, { x: width * 0.3, y: height / 2, id: 2 }])
    await touch('touchEnd', [{ ...point, x: width * 0.95 }])
    await touch('touchEnd', [])
    await expect(step).toHaveText('3')
    await touch('touchStart', [point])
    await touch('touchCancel', [])
    await expect(step).toHaveText('3')
    await session.detach()
  } else {
    await page.mouse.move(width * 0.9, height / 2)
    await page.mouse.down()
    await page.mouse.move(width * 0.6, height / 2, { steps: 6 })
    await page.mouse.move(width * 0.9, height / 2, { steps: 6 })
    await page.mouse.up()
    await expect(step).toHaveText('3')
    await page.mouse.down()
    await page.waitForTimeout(400)
    await page.mouse.up()
    await expect(step).toHaveText('3')
    await page.mouse.click(width * 0.9, height / 2, { button: 'right' })
    await page.keyboard.press('Escape')
    // Escape may leave native fullscreen. Re-enter before checking UI isolation.
    if (await page.getByRole('button', { name: '关闭全屏' }).count() === 0) {
      await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
    }
    await expect(step).toHaveText('3')
  }
  await page.getByRole('button', { name: '搭建操作', exact: true }).click()
  const controls = page.getByRole('region', { name: '搭建操作' })
  await controls.getByRole('button', { name: '视角', exact: true }).click()
  await controls.getByRole('button', { name: /本步零件/ }).click()
  await page.getByRole('button', { name: '收起零件' }).click()
  await expect(step).toHaveText('3')
  await tapAt(page, mobile, 0.9)
  await expect(step).toHaveText('4')
  await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1024, height: 600 })
  await tapAt(page, mobile, 0.1)
  await expect(step).toHaveText('3')
  await page.getByRole('button', { name: '关闭全屏' }).click()
  await page.getByRole('button', { name: '空步骤', exact: true }).click()
  await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
  await tapAt(page, mobile, 0.9)
  await expect(step).toHaveText('29')
  await tapAt(page, mobile, 0.5)
  await expect(navigation.getByRole('button', { name: '完成本课' })).toBeVisible()
  await page.getByRole('button', { name: '关闭全屏' }).click()
})

test('image and 3D share button placement through repeated transitions', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile'
  // Image fullscreen intentionally requests landscape. This is browser emulation, not Android hardware.
  await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1180, height: 757 })
  await page.goto('/?mixed=1&step=3')
  await expect(page.getByTestId('zoomable-slide')).toHaveCount(1)
  if (await page.getByRole('button', { name: '关闭全屏' }).count() === 0) {
    await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
  }
  await expect(page.getByTestId('zoomable-slide')).toBeVisible()
  const navigation = page.getByTestId('immersive-navigation')
  const step = page.getByTestId('fixture-step')
  await tapAt(page, mobile, 0.5)
  await expect(navigation).toHaveAttribute('data-visible', 'true')
  const imageButton = (await navigation.getByRole('button', { name: '下一页' }).boundingBox())!
  await navigation.getByRole('button', { name: '下一页' }).click()
  await expect(step).toHaveText('4')
  await ready3D(page)
  // Model loading can outlast the auto-hide interval; reveal the same controls on demand.
  if (await navigation.getAttribute('data-visible') === 'false') await tapAt(page, mobile, 0.5)
  await expect(navigation).toHaveAttribute('data-visible', 'true')
  const buildButton = (await navigation.getByRole('button', { name: '下一页' }).boundingBox())!
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(buildButton[key]).toBeCloseTo(imageButton[key], 0)
  await page.screenshot({ path: info.outputPath('05-mixed-course-navigation.png') })
  for (let i = 0; i < 2; i++) {
    await tapAt(page, mobile, 0.1)
    await expect(step).toHaveText('3')
    await expect(page.getByTestId('zoomable-slide')).toBeVisible()
    await tapAt(page, mobile, 0.9)
    await expect(step).toHaveText('4')
    await ready3D(page)
  }
  // From the last build step into reflection slides and back.
  await tapAt(page, mobile, 0.9)
  await expect(step).toHaveText('5')
  await tapAt(page, mobile, 0.9)
  await expect(step).toHaveText('6')
  await tapAt(page, mobile, 0.1)
  await expect(step).toHaveText('5')
  await ready3D(page)
  await page.getByRole('button', { name: '关闭全屏' }).click()
  await page.getByRole('button', { name: '全屏横向展示', exact: true }).click()
  await expect(navigation).toHaveAttribute('data-visible', 'false')
  await tapAt(page, mobile, 0.9)
  await expect(step).toHaveText('6')
})

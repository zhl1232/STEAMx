import { expect, test, type Page } from '@playwright/test'
import { skipVisitLoginPrompt } from './visit-prompt'

const route = '/playground/functionwars'
const battlefield = (page: Page) => page.getByRole('img', { name: '函数战争单人战场' })
const expression = (page: Page) => page.getByLabel('轨迹函数', { exact: true })
const fire = (page: Page) => page.getByRole('button', { name: '发射', exact: true })
const description = (page: Page) => page.locator('p').filter({ hasText: /^我方炮台位于 x/ })

async function openGame(page: Page, query = '') {
  await page.goto(`${route}${query}`, { waitUntil: 'domcontentloaded' })
  await expect(expression(page)).toBeVisible()
  const viewport = page.viewportSize()!
  await expectImmersive(page, viewport.width > viewport.height && viewport.height <= 600)
}

async function selectLevel(page: Page, number: number) {
  if (await page.getByRole('button', { name: '退出沉浸', exact: true }).isVisible()) {
    await openOperations(page)
    if (number > 10) await page.getByRole('button', { name: '挑战 11-15', exact: true }).click()
    await page.getByRole('button', { name: new RegExp(`^第 ${number} 关 `) }).click()
    await page.getByRole('button', { name: '关闭操作', exact: true }).click()
    return
  }
  await page.getByText('选择关卡⌄', { exact: true }).click()
  if (number > 10) await page.getByRole('button', { name: '挑战 11-15', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^第 ${number} 关 `) }).click()
  await page.getByText('选择关卡⌄', { exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await skipVisitLoginPrompt(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
  test(`initial battlefield and fire fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page)
    if (viewport.width > viewport.height) await expectImmersive(page, true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    const stage = await battlefield(page).boundingBox()
    const button = await fire(page).boundingBox()
    expect(stage).not.toBeNull()
    expect(button).not.toBeNull()
    expect(stage!.y).toBeLessThanOrEqual(viewport.width > viewport.height ? 140 : 200)
    if (viewport.width < viewport.height) expect(Math.abs(stage!.width / stage!.height - 12 / 7)).toBeLessThan(0.02)
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(viewport.height)
    expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height)
    expect(await expression(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
  })
}

test('invalid origin consumes no shot; horizontal shot wins and next level resets controls', async ({ page }) => {
  await openGame(page)
  await expression(page).fill('1')
  await fire(page).click()
  await expect(page.getByRole('region', { name: '单人炮术控制台' }).getByRole('alert')).toContainText(/f\(0\)/)
  await expect(description(page)).toContainText('尚未发射')
  await expression(page).fill('0')
  await fire(page).click()
  await expect(page.getByText('目标清除', { exact: true })).toBeVisible()
  await expect(page.getByText(/1 发 ·/)).toBeVisible()
  await expect(expression(page)).toBeDisabled()
  await expect(fire(page)).toBeDisabled()
  await page.getByText('调参数试一试', { exact: true }).click()
  await expect(page.getByRole('button', { name: '斜线', exact: true })).toBeDisabled()
  await page.getByText('数学键盘', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'x', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '下一关', exact: true }).click()
  await expect(page.getByText('第 2 关 ·', { exact: false }).first()).toBeVisible()
  await expect(expression(page)).toBeEnabled()
  await expect(fire(page)).toBeEnabled()
  await expect(description(page)).toContainText('尚未发射')
})

test('templates and sliders update preview without firing or recording stats; keyboard expands', async ({ page }) => {
  await openGame(page)
  const statsBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /function.?wars.*stats/i.test(key))))
  const before = await description(page).innerText()
  await expect(page.getByRole('button', { name: 'x', exact: true })).not.toBeVisible()
  await page.getByText('调参数试一试', { exact: true }).click()
  await page.getByRole('button', { name: '斜线', exact: true }).click()
  await expect(expression(page)).toHaveValue('0.25*x')
  await page.getByRole('slider', { name: '斜率 a', exact: true }).fill('0.35')
  await expect(expression(page)).toHaveValue('0.35*x')
  await expect(page.locator('.function-wars-feedback')).toContainText('不消耗弹药')
  await expect(description(page)).toHaveText(before)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /function.?wars.*stats/i.test(key))))).toEqual(statsBefore)
  await page.getByText('数学键盘', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'sin(', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '更多函数', exact: true }).click()
  await page.getByRole('button', { name: 'sin(', exact: true }).click()
  await expect(expression(page)).toHaveValue('0.35*xsin(')
})

test('online invitation keeps login return room and has no single player preview', async ({ page }) => {
  await page.goto(`${route}?room=ABC123`, { waitUntil: 'domcontentloaded' })
  const login = page.getByRole('link', { name: '登录并继续' })
  await expect(login).toBeVisible()
  const href = new URL((await login.getAttribute('href'))!, 'http://127.0.0.1:3000')
  expect(href.searchParams.get('next')).toBe(`${route}?room=ABC123`)
  await expect(page.getByLabel('试射预览', { exact: true })).not.toBeVisible()
})

for (const { number, theme, width, height } of [
  { number: 6, theme: 'light', width: 1440, height: 1000 },
  { number: 15, theme: 'dark', width: 1440, height: 1000 },
  { number: 15, theme: 'dark', width: 320, height: 844 },
]) {
  test(`level ${number} ${theme} ${width}px renders without errors and captures mission`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height })
    await page.addInitScript(value => localStorage.setItem('theme', value), theme)
    await trackDrawnArt(page)
    await openGame(page)
    await selectLevel(page, number)
    await expectArtDrawn(page, number === 6 ? 'canyon-backdrop.webp' : 'space-backdrop.webp')
    await expectArtDrawn(page, 'enemy-armored.webp')
    if (number === 15) await expect(page.getByLabel('本关任务', { exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveClass(new RegExp(theme))
    await expect(battlefield(page)).toBeVisible()
    if (theme === 'dark') {
      for (const text of ['调参数试一试', '数学键盘', '先让 abs 的镜像轨迹同步分流，再用 sin 穿入中央核心。']) {
        const contrast = await page.getByText(text, { exact: true }).evaluate(renderedTextContrast)
        expect(contrast, `${text} text contrast`).toBeGreaterThanOrEqual(4.5)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `/tmp/function-wars-level-${number}-${theme}-${width}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('challenge 15 cleared with the wrong effective function fails immediately', async ({ page }) => {
  await openGame(page)
  await selectLevel(page, 15)
  await page.getByRole('button', { name: /^镜像/ }).click()
  await expression(page).fill('0.4*abs(x-8)-3.2')
  await fire(page).click()
  await expect(fire(page)).toBeEnabled()
  await page.getByRole('button', { name: /^钻地/ }).click()
  await expression(page).fill('0.01*abs(x)')
  await fire(page).click()
  await expect(page.getByText('目标已清除，任务未完成', { exact: true })).toBeVisible()
  await expect(fire(page)).toBeDisabled()
  await expect(expression(page)).toBeDisabled()
})

async function expectImmersive(page: Page, enabled: boolean) {
  await expect(page.getByRole('button', { name: enabled ? '退出沉浸' : '展开战场', exact: true })).toBeVisible()
  await expect(page.locator('.function-wars-page')).toHaveAttribute('data-immersive', String(enabled))
}

async function openOperations(page: Page) {
  await page.getByRole('button', { name: '操作', exact: true }).click()
  await expect(page.getByRole('button', { name: '关闭操作', exact: true })).toBeFocused()
}

for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 320 }]) {
  test(`landscape immersion fills battlefield and keeps dock usable ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await trackDrawnArt(page)
    if (viewport.width === 844) await trackLevelTenLabels(page)
    await page.setViewportSize(viewport)
    await openGame(page)
    await expectImmersive(page, true)
    await expectArtDrawn(page, 'grassland-backdrop.webp')
    await expectArtDrawn(page, 'player-turret.webp')
    await expectArtDrawn(page, 'enemy.webp')
    const stage = await battlefield(page).boundingBox()
    const input = await expression(page).boundingBox()
    const button = await fire(page).boundingBox()
    expect(stage!.height).toBeGreaterThanOrEqual(viewport.height * 0.65)
    expect(stage!.width).toBeGreaterThanOrEqual(viewport.width * 0.65)
    const dock = await page.getByRole('region', { name: '单人炮术控制台' }).locator('.function-wars-dock').boundingBox()
    expect(stage!.x).toBeCloseTo(0, 0)
    expect(stage!.y).toBeCloseTo(0, 0)
    expect(stage!.width).toBeCloseTo(viewport.width, 0)
    expect(stage!.height).toBeCloseTo(viewport.height - dock!.height, 0)
    expect(button!.height).toBeGreaterThanOrEqual(44)
    expect(button!.width).toBeGreaterThanOrEqual(44)
    expect(await expression(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    expect(stage!.x).toBeGreaterThanOrEqual(0)
    expect(stage!.y).toBeGreaterThanOrEqual(0)
    expect(stage!.x + stage!.width).toBeLessThanOrEqual(viewport.width)
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(input!.y)
    expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height)
    expect(input!.y + input!.height).toBeLessThanOrEqual(viewport.height)
    await expression(page).fill('0.25*x')
    await expect(expression(page)).toHaveValue('0.25*x')
    await expect(fire(page)).toBeEnabled()
    await page.screenshot({ path: `/tmp/function-wars-immersive-${viewport.width}x${viewport.height}.png` })
    if (viewport.width === 844) {
      await selectLevel(page, 10)
      await expectArtDrawn(page, 'space-backdrop.webp')
      await expectArtDrawn(page, 'enemy-armored.webp')
      await expectArtDrawn(page, 'crate.webp')
      const hud = await page.locator('.function-wars-immersive-status').boundingBox()
      expect(hud).not.toBeNull()
      for (const target of ['1', '2']) {
        await expect.poll(() => page.evaluate(id => Boolean((window as unknown as LabelProbeWindow).functionWarsTargetLabelBoxes[id]), target)).toBe(true)
        const label = await page.evaluate(id => (window as unknown as LabelProbeWindow).functionWarsTargetLabelBoxes[id], target)
        const overlaps = label.x < hud!.x + hud!.width && label.x + label.width > hud!.x && label.y < hud!.y + hud!.height && label.y + label.height > hud!.y
        expect(overlaps, `target ${target}: ${JSON.stringify({ label, hud })}`).toBe(false)
      }
      await page.screenshot({ path: '/tmp/function-wars-immersive-level10-label-clearance-844.png' })
    }
    expect(errors).toEqual([])
  })
}

test('rotation keeps expression, shot progress and mounted battlefield; explicit exit stays exited', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openGame(page)
  await expectImmersive(page, false)
  const originalCanvas = await battlefield(page).elementHandle()
  await expression(page).fill('0.25*x')
  await fire(page).click()
  await expect(description(page)).toContainText('上一发函数 0.25*x')
  await expect(fire(page)).toBeEnabled()
  await page.setViewportSize({ width: 844, height: 390 })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expectImmersive(page, true)
  await expect(expression(page)).toHaveValue('0.25*x')
  await expect(page.getByText(/第 1 关.*已射 1 发/)).toBeVisible()
  expect(await originalCanvas!.evaluate(node => node.isConnected)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expectImmersive(page, false)
  await expect(expression(page)).toHaveValue('0.25*x')
  await expect(description(page)).toContainText('上一发函数 0.25*x')
  expect(await originalCanvas!.evaluate(node => node.isConnected)).toBe(true)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expectImmersive(page, true)
  await page.getByRole('button', { name: '退出沉浸', exact: true }).click()
  await expectImmersive(page, false)
  await page.setViewportSize({ width: 820, height: 390 })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expectImmersive(page, false)
  await expect(expression(page)).toHaveValue('0.25*x')
})

test('manual fullscreen rejection falls back to immersion and Escape restores scroll and state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: async function () { throw new DOMException('Denied for test', 'NotAllowedError') },
    })
  })
  await openGame(page)
  await expression(page).fill('0.15*x')
  await page.evaluate(() => window.scrollTo(0, 100))
  const scrollBefore = await page.evaluate(() => window.scrollY)
  const originalInput = await expression(page).elementHandle()
  await page.getByRole('button', { name: '展开战场', exact: true }).evaluate(button => (button as HTMLButtonElement).click())
  await expectImmersive(page, true)
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
  await expect(expression(page)).toHaveValue('0.15*x')
  await page.keyboard.press('Escape')
  await expectImmersive(page, false)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  expect(await originalInput!.evaluate(node => node.isConnected)).toBe(true)
})

test('operation drawer returns focus, switches level and mode without losing single-player state', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await expectImmersive(page, true)
  await expect(page.getByRole('button', { name: '斜线', exact: true })).not.toBeVisible()
  await openOperations(page)
  await page.keyboard.press('Escape')
  await expectImmersive(page, true)
  await expect(page.getByRole('button', { name: '操作', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: '关闭操作', exact: true })).not.toBeVisible()
  await openOperations(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectImmersive(page, false)
  await page.setViewportSize({ width: 844, height: 390 })
  await expectImmersive(page, true)
  await expect(page.getByRole('button', { name: '关闭操作', exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '操作', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await openOperations(page)
  await page.getByRole('button', { name: /^第 2 关 / }).click()
  await page.getByRole('button', { name: '关闭操作', exact: true }).click()
  await expect(page.getByRole('button', { name: '操作', exact: true })).toBeFocused()
  await expression(page).fill('0.3*x')
  const originalInput = await expression(page).elementHandle()
  await openOperations(page)
  await page.getByRole('button', { name: '真人对战', exact: true }).click()
  await expect(page.getByRole('link', { name: '登录并继续' })).toBeVisible()
  await page.getByRole('button', { name: '单人战役', exact: true }).click()
  await expect(page.getByRole('button', { name: '操作', exact: true })).toBeFocused()
  await expect(expression(page)).toHaveValue('0.3*x')
  await expect(page.getByText(/第 2 关.*已射 0 发/)).toBeVisible()
  expect(await originalInput!.evaluate(node => node.isConnected)).toBe(true)
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 844, height: 390 },
  { width: 667, height: 320 },
  { width: 1280, height: 900 },
]) {
  test(`win displays stars and next level on battlefield without scrolling ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page)
    const immersive = viewport.width > viewport.height && viewport.height <= 600
    const scrollBefore = await page.evaluate(() => window.scrollY)
    await expression(page).fill('0')
    await fire(page).click()
    const result = page.locator('[data-result="won"]')
    await expect(result.getByText('目标清除', { exact: true })).toBeVisible()
    const next = result.getByRole('button', { name: '下一关', exact: true })
    const stars = result.getByLabel('3 星', { exact: true })
    await expect(stars).toBeVisible()
    await expect(next).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
    const stage = await battlefield(page).boundingBox()
    for (const control of [stars, next]) {
      const box = await control.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(stage!.x)
      expect(box!.y).toBeGreaterThanOrEqual(stage!.y)
      expect(box!.x + box!.width).toBeLessThanOrEqual(stage!.x + stage!.width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(stage!.y + stage!.height)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: `/tmp/function-wars-result-win-${viewport.width}x${viewport.height}.png` })
    await next.click()
    await expectImmersive(page, immersive)
    await expect(result).not.toBeVisible()
    await expect(description(page)).toContainText('尚未发射')
    await expect(expression(page)).toHaveValue('0')
    await expect(expression(page)).toBeEnabled()
    await expect(fire(page)).toBeEnabled()
    if (immersive) await expect(page.getByText(/第 2 关.*已射 0 发/)).toBeVisible()
    else await expect(page.getByText('第 2 关 ·', { exact: false }).first()).toBeVisible()
  })
}

test('landscape invitation keeps login reachable within immersive lobby', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 })
  await page.goto(`${route}?room=ABC123`, { waitUntil: 'domcontentloaded' })
  await expectImmersive(page, true)
  const login = page.getByRole('link', { name: '登录并继续' })
  await expect(login).toBeVisible()
  await login.scrollIntoViewIfNeeded()
  const box = await login.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(375)
  const href = new URL((await login.getAttribute('href'))!, 'http://127.0.0.1:3000')
  expect(href.searchParams.get('next')).toBe(`${route}?room=ABC123`)
  await page.screenshot({ path: '/tmp/function-wars-immersive-invite.png' })
})


type ArtProbeWindow = Window & { functionWarsDrawnArt: string[]; functionWarsEnemyDrawTimes: number[]; functionWarsPlayerTransforms: number[][] }
const artPrefix = '/assets/playground-art/function-wars/v2/'

async function trackDrawnArt(page: Page) {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage
    const observedWindow = window as unknown as ArtProbeWindow
    observedWindow.functionWarsDrawnArt = []
    observedWindow.functionWarsEnemyDrawTimes = []
    observedWindow.functionWarsPlayerTransforms = []
    CanvasRenderingContext2D.prototype.drawImage = function (source: CanvasImageSource, ...args: number[]) {
      if (source instanceof HTMLImageElement && source.src.includes('/assets/playground-art/function-wars/v2/')) {
        const path = new URL(source.src).pathname
        if (path.endsWith('/enemy.webp')) observedWindow.functionWarsEnemyDrawTimes.push(performance.now())
        if (path.endsWith('/player-turret.webp')) {
          const matrix = this.getTransform()
          observedWindow.functionWarsPlayerTransforms.push([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])
        }
        if (!observedWindow.functionWarsDrawnArt.includes(path)) observedWindow.functionWarsDrawnArt.push(path)
      }
      return Reflect.apply(original, this, [source, ...args])
    }
  })
}

async function expectArtDrawn(page: Page, filename: string) {
  await expect.poll(() => page.evaluate(() => (window as unknown as ArtProbeWindow).functionWarsDrawnArt)).toContain(`${artPrefix}${filename}`)
}

for (const viewport of [{ width: 320, height: 844 }, { width: 844, height: 390 }]) {
  test(`art loads on demand and all three scenes draw real assets ${viewport.width}px`, async ({ page }) => {
    const failures: string[] = []
    const requestedBackdrops: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('console', message => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('response', response => {
      if (response.url().includes(artPrefix) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
    })
    page.on('request', request => {
      if (request.url().includes(artPrefix) && request.url().includes('-backdrop.webp')) requestedBackdrops.push(new URL(request.url()).pathname)
    })
    await trackDrawnArt(page)
    await page.setViewportSize(viewport)
    await openGame(page)
    if (viewport.width > viewport.height) await expectImmersive(page, true)
    await expectArtDrawn(page, 'grassland-backdrop.webp')
    await expectArtDrawn(page, 'player-turret.webp')
    await expectArtDrawn(page, 'enemy.webp')
    expect(requestedBackdrops).toEqual([`${artPrefix}grassland-backdrop.webp`])
    for (const { level, theme } of [
      { level: 1, theme: 'grassland' },
      { level: 6, theme: 'canyon' },
      { level: 15, theme: 'space' },
    ]) {
      if (level !== 1) await selectLevel(page, level)
      await expectArtDrawn(page, `${theme}-backdrop.webp`)
      if (level === 6) {
        await expectArtDrawn(page, 'enemy-armored.webp')
        await expectArtDrawn(page, 'crate.webp')
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      await page.screenshot({ path: `/tmp/function-wars-art-${theme}-${viewport.width}.png`, fullPage: viewport.width < viewport.height })
    }
    expect(requestedBackdrops).toEqual(['grassland', 'canyon', 'space'].map(theme => `${artPrefix}${theme}-backdrop.webp`))
    expect(failures).toEqual([])
  })
}

test('missing art keeps a painted fallback and playable battle', async ({ page }) => {
  const pageErrors: string[] = []
  const blocked: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route(`**${artPrefix}*`, async route => {
    blocked.push(route.request().url())
    await route.abort('failed')
  })
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await expectImmersive(page, true)
  await expect.poll(() => blocked.length).toBeGreaterThan(0)
  await expect.poll(() => battlefield(page).evaluate(canvas => {
    const element = canvas as HTMLCanvasElement
    return element.getContext('2d')!.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data[3]
  })).toBe(255)
  await page.screenshot({ path: '/tmp/function-wars-art-fallback.png' })
  await expression(page).fill('0')
  await fire(page).click()
  await expect(page.getByText('目标清除', { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})


test('preview stays still and animated shot retains its target until impact', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackDrawnArt(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await expectImmersive(page, true)
  await expectArtDrawn(page, 'grassland-backdrop.webp')
  await expectArtDrawn(page, 'player-turret.webp')
  await expectArtDrawn(page, 'enemy.webp')
  const beforePreview = await page.evaluate(() => {
    const matrices = (window as unknown as ArtProbeWindow).functionWarsPlayerTransforms
    return { count: matrices.length, last: matrices[matrices.length - 1] }
  })
  await expression(page).fill('0.25*x')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  // Ambient backdrop frames are allowed; preview must never move the cannon as recoil does.
  await page.waitForTimeout(150)
  const previewMatrices = await page.evaluate(index => (window as unknown as ArtProbeWindow).functionWarsPlayerTransforms.slice(index), beforePreview.count)
  expect(previewMatrices.length).toBeGreaterThan(0)
  expect([...new Set(previewMatrices.map(matrix => JSON.stringify(matrix)))]).toEqual([JSON.stringify(beforePreview.last)])
  await expect(description(page)).toContainText('尚未发射')
  await expression(page).fill('0')
  const started = await page.evaluate(() => {
    (window as unknown as ArtProbeWindow).functionWarsEnemyDrawTimes = []
    return performance.now()
  })
  await fire(page).click()
  await expect(fire(page)).toBeDisabled()
  await expect(page.getByText('目标清除', { exact: true })).not.toBeVisible()
  await expect.poll(() => page.evaluate(start => (window as unknown as ArtProbeWindow).functionWarsEnemyDrawTimes.some(time => time >= start + 100), started)).toBe(true)
  await page.screenshot({ path: '/tmp/function-wars-art-shot-in-flight.png' })
  await expect(page.getByText('目标清除', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/function-wars-art-shot-finished.png' })
})


test('coordinate grid starts hidden and toggles without changing preview or shot progress', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await openGame(page)
  const showGrid = page.getByRole('button', { name: '显示坐标网格', exact: true })
  await expect(showGrid).toHaveAttribute('aria-pressed', 'false')
  await expression(page).fill('0.25*x')
  await expect(page.locator('.function-wars-feedback')).toBeVisible()
  const previewBefore = await page.locator('.function-wars-feedback').innerText()
  const progressBefore = await description(page).innerText()
  await showGrid.click()
  const hideGrid = page.getByRole('button', { name: '隐藏坐标网格', exact: true })
  await expect(hideGrid).toHaveAttribute('aria-pressed', 'true')
  await expect(expression(page)).toHaveValue('0.25*x')
  await expect(page.locator('.function-wars-feedback')).toHaveText(previewBefore)
  await expect(description(page)).toHaveText(progressBefore)
  await hideGrid.click()
  await expect(showGrid).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.function-wars-feedback')).toHaveText(previewBefore)
  await expect(description(page)).toHaveText(progressBefore)
})


type LabelProbeWindow = Window & { functionWarsTargetLabelBoxes: Record<string, { x: number; y: number; width: number; height: number }> }

async function trackLevelTenLabels(page: Page) {
  await page.addInitScript(() => {
    const observedWindow = window as unknown as LabelProbeWindow
    observedWindow.functionWarsTargetLabelBoxes = {}
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, maxWidth?: number) {
      const target = /^(?:目标 )?([12]) \(13\.5,-?3\.2\)$/.exec(text)
      if (target && this.canvas.getAttribute('aria-label') === '函数战争单人战场') {
        const width = this.measureText(text).width + 12
        const bounds = this.canvas.getBoundingClientRect()
        const ratio = this.canvas.width / bounds.width
        const matrix = this.getTransform()
        const first = matrix.transformPoint(new DOMPoint(x - width / 2, y - 9))
        const last = matrix.transformPoint(new DOMPoint(x + width / 2, y + 9))
        observedWindow.functionWarsTargetLabelBoxes[target[1]] = {
          x: bounds.x + first.x / ratio, y: bounds.y + first.y / ratio,
          width: (last.x - first.x) / ratio, height: (last.y - first.y) / ratio,
        }
      }
      return maxWidth === undefined ? original.call(this, text, x, y) : original.call(this, text, x, y, maxWidth)
    }
  })
}


function renderedTextContrast(element: Element): number {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')!
  const rgba = (color: string) => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value)
  }
  const layers: number[][] = []
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) layers.push(rgba(getComputedStyle(ancestor).backgroundColor))
  let background = [255, 255, 255]
  for (const layer of layers.reverse()) background = background.map((value, index) => layer[index] * layer[3] + value * (1 - layer[3]))
  const ink = rgba(getComputedStyle(element).color)
  const foreground = background.map((value, index) => ink[index] * ink[3] + value * (1 - ink[3]))
  const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  const values = [luminance(background), luminance(foreground)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}


for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 320 }]) {
  test(`compact parameters reserve battlefield space and remain interactive ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page)
    await page.getByText('模板', { exact: true }).click()
    await page.getByRole('button', { name: '波浪', exact: true }).click()
    const slider = page.getByRole('slider', { name: '振幅 a', exact: true })
    await expect(slider).toBeVisible()
    await expect(page.getByRole('button', { name: '关闭操作', exact: true })).not.toBeVisible()
    await slider.fill('1.2')
    await expect(expression(page)).toHaveValue('1.2*sin(0.5*x)')
    await expect(description(page)).toContainText('尚未发射')
    const stage = await battlefield(page).boundingBox()
    const parameters = await page.getByLabel('战场参数调节', { exact: true }).boundingBox()
    expect(stage!.height).toBeGreaterThan(150)
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(parameters!.y)
    for (const control of [slider, expression(page), fire(page)]) {
      const bounds = await control.boundingBox()
      expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: `/tmp/function-wars-parameters-${viewport.width}x${viewport.height}.png` })
    await fire(page).click()
    await expect(description(page)).toContainText('上一发函数 1.2*sin(0.5*x)')
    await expect(expression(page)).toBeEnabled()
    await page.getByRole('button', { name: '关闭调参，保留函数', exact: true }).click()
    await expect(slider).not.toBeVisible()
    await expect(expression(page)).toHaveValue('1.2*sin(0.5*x)')
  })
}

test('quick weapon keyboard chooser restores focus and empty ammo selects standard', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await selectLevel(page, 7)
  const chooser = page.getByRole('button', { name: /^当前武器：/ })
  await chooser.focus()
  await page.keyboard.press('Enter')
  await expect(chooser).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(chooser).toBeFocused()
  await expect(chooser).toHaveAttribute('aria-expanded', 'false')
  await expectImmersive(page, true)
  await chooser.click()
  await page.locator('.function-wars-weapon-options').getByRole('button', { name: /^重磅/ }).click()
  await expect(chooser).toBeFocused()
  await expect(chooser).toHaveAttribute('aria-expanded', 'false')
  await expression(page).fill('-x')
  await fire(page).click()
  await expect(chooser).toHaveAccessibleName('当前武器：标准，弹药 ∞')
  await expect(page.getByText('重磅炮弹弹药已用完，已切换为标准炮弹', { exact: true })).toBeVisible()
})

test('split cascade clears level seven in one shot and best solution survives changing levels', async ({ page }) => {
  await openGame(page)
  await selectLevel(page, 7)
  await page.getByRole('button', { name: /^分裂/ }).click()
  await expression(page).fill('x-x^2/24')
  await expect(page.locator('.function-wars-feedback')).toContainText('预览：')
  await expect(description(page)).toContainText('尚未发射')
  await page.screenshot({ path: '/tmp/function-wars-split-showcase.png', fullPage: true })
  await fire(page).click()
  await expect(page.getByText('目标清除', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/function-wars-split-cleared.png', fullPage: true })
  await expect(page.getByText('本关最佳解法 · 3 星 / 1 发', { exact: true })).toBeVisible()
  await selectLevel(page, 1)
  await selectLevel(page, 7)
  await page.getByText('选择关卡⌄', { exact: true }).click()
  await expect(page.getByRole('button', { name: /^第 7 关 残垒清扫，最好 3 星$/ })).toBeVisible()
  await page.getByText('选择关卡⌄', { exact: true }).click()
  await page.getByText('本关最佳解法 · 3 星 / 1 发', { exact: true }).click()
  await page.getByRole('button', { name: '载入第 1 发', exact: true }).click()
  await expect(expression(page)).toHaveValue('x-x^2/24')
  await expect(description(page)).toContainText('尚未发射')
})

test('phase gate preview preserves shots and a single sin shot connects both relays', async ({ page }) => {
  await openGame(page)
  await selectLevel(page, 11)
  await expression(page).fill('2*sin(pi*x/10)')
  await expect(page.locator('.function-wars-feedback')).toContainText('预览：')
  await expect(page.locator('.function-wars-mission-chips')).toContainText('中继 0/2')
  await expect(description(page)).toContainText('剩余 5 发')
  await fire(page).click()
  await expect(page.getByText('目标清除', { exact: true })).toBeVisible()
  await expect(page.locator('.function-wars-mission-chips')).toContainText('中继 2/2')
  await expect(page.getByText('本关最佳解法 · 3 星 / 1 发', { exact: true })).toBeVisible()
})

test('preview warns before fatal mission shot and retry keeps the attempted formula', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await selectLevel(page, 15)
  const chooser = page.getByRole('button', { name: /^当前武器：/ })
  await chooser.click()
  await page.locator('.function-wars-weapon-options').getByRole('button', { name: /^镜像/ }).click()
  await expression(page).fill('0.4*abs(x-8)-3.2')
  await fire(page).click()
  await expect(fire(page)).toBeEnabled()
  await chooser.click()
  await page.locator('.function-wars-weapon-options').getByRole('button', { name: /^钻地/ }).click()
  const before = await description(page).innerText()
  await expression(page).fill('0.01*abs(x)')
  await expect(page.locator('.function-wars-feedback')).toContainText('预览：')
  await expect(page.locator('.function-wars-feedback')).toContainText(/还需有效使用 sin.*任务失败/)
  await expect(page.locator('.function-wars-mission-chips')).toContainText('有效 sin')
  await expect(description(page)).toHaveText(before)
  await expect(page.getByText('目标已清除，任务未完成', { exact: true })).not.toBeVisible()
  await page.screenshot({ path: '/tmp/function-wars-fatal-preview-844.png' })
  await fire(page).click()
  await expect(page.getByText('目标已清除，任务未完成', { exact: true })).toBeVisible()
  const retry = page.locator('[data-result=lost]').getByRole('button', { name: '重开本关', exact: true })
  const retryBounds = await retry.boundingBox()
  expect(retryBounds!.y).toBeGreaterThanOrEqual(0)
  expect(retryBounds!.y + retryBounds!.height).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '/tmp/function-wars-result-loss-844.png' })
  await retry.click()
  await expect(expression(page)).toHaveValue('0.01*abs(x)')
  await expect(description(page)).toContainText('尚未发射')
  await expect(fire(page)).toBeEnabled()
})

test('last shot feedback changes back to preview when the formula is edited', async ({ page }) => {
  await openGame(page)
  await selectLevel(page, 2)
  await expression(page).fill('0')
  await fire(page).click()
  await expect(page.locator('.function-wars-feedback')).toContainText('上一发：')
  await expect(page.locator('.function-wars-feedback')).toContainText('击中土层')
  const before = await description(page).innerText()
  await expression(page).fill('0.25*x')
  await expect(page.locator('.function-wars-feedback')).toContainText('预览：')
  await expect(page.locator('.function-wars-feedback')).toContainText('命中 1 个目标')
  await expect(description(page)).toHaveText(before)
  await expect(expression(page)).toHaveValue('0.25*x')
})


for (const viewport of [{ width: 320, height: 740 }, { width: 667, height: 320 }]) {
  test(`final result keeps retry and level selection reachable ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page)
    await selectLevel(page, 15)
    const immersive = viewport.width > viewport.height
    const chooseWeapon = async (name: RegExp) => {
      if (immersive) {
        await page.getByRole('button', { name: /^当前武器：/ }).click()
        await page.locator('.function-wars-weapon-options').getByRole('button', { name }).click()
      } else await page.getByRole('button', { name }).click()
    }
    await chooseWeapon(/^镜像/)
    await expression(page).fill('0.4*abs(x-8)-3.2')
    await fire(page).click()
    await expect(fire(page)).toBeEnabled()
    await chooseWeapon(/^钻地/)
    await expression(page).fill('0.1*sin(pi*x/10)')
    await fire(page).click()
    const result = page.locator('[data-result="won"]')
    await expect(result).toBeVisible()
    await expect(result.getByLabel('3 星', { exact: true })).toBeVisible()
    await expect(result.getByRole('button', { name: '下一关', exact: true })).toHaveCount(0)
    const retry = result.getByRole('button', { name: '保留函数再挑战', exact: true })
    await expect(retry).toBeVisible()
    const retryBounds = await retry.boundingBox()
    expect(retryBounds!.y).toBeGreaterThanOrEqual(0)
    expect(retryBounds!.y + retryBounds!.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: `/tmp/function-wars-result-final-${viewport.width}x${viewport.height}.png` })
    if (immersive) {
      await retry.click()
      await expect(result).not.toBeVisible()
      await expect(expression(page)).toHaveValue('0.1*sin(pi*x/10)')
      await expect(fire(page)).toBeEnabled()
    } else {
      await result.getByText('返回选关', { exact: true }).click()
      await result.getByRole('button', { name: '战役 1-10', exact: true }).click()
      const firstLevel = result.getByRole('button', { name: /^第 1 关 / })
      await firstLevel.scrollIntoViewIfNeeded()
      const box = await firstLevel.boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
      await firstLevel.click()
      await expect(result).not.toBeVisible()
      await expect(page.getByText('第 1 关 ·', { exact: false }).first()).toBeVisible()
      await expect(fire(page)).toBeEnabled()
    }
  })
}


for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 320 }]) {
  test(`win remains inside battlefield after manually leaving immersion ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page)
    await page.getByRole('button', { name: '退出沉浸', exact: true }).click()
    await expectImmersive(page, false)
    await expression(page).fill('0')
    await fire(page).click()
    const result = page.locator('[data-result="won"]')
    await expect(result).toBeVisible()
    const canvas = await battlefield(page).boundingBox()
    const layer = await page.locator('.function-wars-result-layer').boundingBox()
    const shell = await page.locator('.function-wars-battlefield-shell').boundingBox()
    expect(layer!.x).toBeCloseTo(shell!.x, 0)
    expect(layer!.y).toBeCloseTo(shell!.y, 0)
    expect(layer!.width).toBeCloseTo(shell!.width, 0)
    expect(layer!.height).toBeCloseTo(shell!.height, 0)
    const stars = result.getByLabel('3 星', { exact: true })
    const next = result.getByRole('button', { name: '下一关', exact: true })
    for (const control of [stars, next]) {
      await expect(control).toBeInViewport({ ratio: 1 })
      const box = await control.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(canvas!.x)
      expect(box!.y).toBeGreaterThanOrEqual(canvas!.y)
      expect(box!.x + box!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height)
    }
    await page.screenshot({ path: `/tmp/function-wars-result-exited-${viewport.width}x${viewport.height}.png` })
    await next.click()
    await expectImmersive(page, false)
    await expect(result).not.toBeVisible()
    await expect(page.getByText('第 2 关 ·', { exact: false }).first()).toBeVisible()
    await expect(fire(page)).toBeEnabled()
  })
}

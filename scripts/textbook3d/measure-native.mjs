// Local browser acceptance/measurement only. Does not deploy or contact a database.
// Requires a working sandboxed Chromium. Never retries with --no-sandbox.
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const baseURL = process.env.TEXTBOOK_PREVIEW_URL || 'http://127.0.0.1:3000'
const output = process.env.TEXTBOOK_EVIDENCE_DIR || '/tmp/textbook-native-evidence'
const executablePath = process.env.TEXTBOOK_BROWSER_EXECUTABLE
await mkdir(output, { recursive: true })
const results = { baseURL, measuredAt: new Date().toISOString(), mode: 'local development; no old/new performance comparison', viewports: [] }
let browser
try {
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, ...(executablePath ? { executablePath } : {}) })
  for (const viewport of [
    { name: 'phone-portrait', width: 390, height: 844, mobile: true },
    { name: 'phone-landscape', width: 844, height: 390, mobile: true },
    { name: 'desktop', width: 1440, height: 1000, mobile: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile, deviceScaleFactor: viewport.mobile ? 3 : 1 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const open = async () => {
      await page.goto(`${baseURL}/textbook/p1a-1-1`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-render-state="ready"]').waitFor({ timeout: 30_000 })
      assert.equal(await page.locator('[data-render-state] canvas').count(), 1)
      assert.equal(await page.locator('iframe').count(), 0)
    }
    const stats = async () => page.locator('[data-render-state] canvas').evaluate((canvas) => {
      if (typeof canvas.textbookDiagnostics !== 'function') throw new Error('Run the local development server to enable renderer diagnostics')
      return canvas.textbookDiagnostics()
    })
    const settle = async () => { await page.waitForFunction(() => !document.querySelector('[data-render-state] canvas')?.textbookDiagnostics?.().pendingFrame) }
    const choose = async (name) => {
      await page.getByRole('group', { name: '选择观察的植物' }).getByRole('button', { name, exact: true }).click()
      await settle()
    }
    await open()
    const initial = await stats()
    assert.ok(initial.pixels <= 1_500_001)
    assert.ok(initial.dpr <= 1.5)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: `${output}/${viewport.name}-page1.png`, fullPage: true })
    await page.getByRole('button', { name: '全屏阅读', exact: true }).click()
    await page.locator('[data-immersive="true"]').waitFor()
    await settle()
    const bounds = await page.locator('[data-immersive="true"]').boundingBox()
    assert.ok(bounds.width <= viewport.width + 1 && bounds.height <= viewport.height + 1)
    await page.screenshot({ path: `${output}/${viewport.name}-fullscreen.png` })
    const stageBounds = await page.locator('[data-render-state] canvas').boundingBox()
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(stageBounds.x + stageBounds.width * 0.35, stageBounds.y + stageBounds.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(stageBounds.x + stageBounds.width * 0.65, stageBounds.y + stageBounds.height * 0.5, { steps: 30 })
      await page.mouse.up()
    }
    await settle()
    const drag = await stats()
    for (const name of ['大树', '小草', '花', '大树']) await choose(name)
    const warmed = await stats()
    const trend = []
    for (let i = 0; i < 10; i++) {
      for (const name of ['小草', '花', '大树']) await choose(name)
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      await page.getByRole('button', { name: '上一页', exact: true }).click()
      await page.getByRole('button', { name: '退出全屏', exact: true }).click()
      await page.getByRole('button', { name: '全屏阅读', exact: true }).click()
      await settle()
      const current = await stats()
      assert.equal(current.geometries, warmed.geometries)
      assert.equal(current.textures, warmed.textures)
      assert.equal(await page.locator('[data-render-state] canvas').count(), 1)
      trend.push({ ...current, usedJSHeapSize: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null) })
    }
    const idleBefore = await stats()
    await page.waitForTimeout(600)
    assert.equal((await stats()).renders, idleBefore.renders)
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await page.getByRole('heading', { name: '带着发现，去找一找' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/${viewport.name}-page2.png`, fullPage: true })
    await page.getByRole('button', { name: '退出全屏', exact: true }).click()
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    const routeTrend = []
    for (let i = 0; i < 3; i++) {
      await page.getByRole('link', { name: /^下一节：/ }).click()
      await page.locator('iframe').waitFor()
      assert.equal(await page.locator('[data-render-state] canvas').count(), 0)
      await page.getByRole('link', { name: /^上一节：/ }).click()
      await page.locator('[data-render-state="ready"]').waitFor()
      routeTrend.push(await stats())
    }
    assert.deepEqual(errors, [])
    results.viewports.push({ ...viewport, initial, drag, warmed, trend, routeTrend })
    await context.close()
  }
  // Verify readable content/retry remain available without WebGL.
  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await fallbackContext.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith('webgl') || type === 'experimental-webgl') return null
      return getContext.call(this, type, ...args)
    }
  })
  const fallbackPage = await fallbackContext.newPage()
  await fallbackPage.goto(`${baseURL}/textbook/p1a-1-1`)
  await fallbackPage.getByRole('button', { name: '重新加载 3D' }).waitFor()
  await fallbackPage.getByRole('button', { name: '下一页', exact: true }).click()
  assert.equal(await fallbackPage.getByText('说出 5 种你认识的植物', { exact: true }).count(), 1)
  await fallbackPage.screenshot({ path: `${output}/webgl-fallback.png`, fullPage: true })
  await fallbackContext.close()
  results.status = 'passed'
} catch (error) {
  results.status = 'incomplete'
  results.error = error.message
  process.exitCode = 1
} finally {
  await browser?.close()
  await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ status: results.status, completedViewports: results.viewports.length, evidence: output, error: results.error }))
}

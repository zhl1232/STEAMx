import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const output = '/tmp/store-project-review'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const consoleErrors = []
const httpErrors = []
const blocked = []
let assertions = 0
const check = async action => { await action(); assertions++ }
try {
  for (const [port, catalog] of [[3112, true], [3113, false]]) {
    const base = `http://127.0.0.1:${port}`
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, serviceWorkers: 'block' })
      await context.addInitScript(() => {
        sessionStorage.setItem('steamx:visit-prompt:v1', '1')
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
        localStorage.setItem('steamx:login-nudge:dismissed-day', today)
      })
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
        blocked.push({ origin: url.origin, type: route.request().resourceType() })
        return route.abort()
      })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      page.on('response', response => { if (response.status() >= 400) httpErrors.push({ path: new URL(response.url()).pathname, status: response.status(), type: response.request().resourceType() }) })
      const availability = page.waitForResponse(response => response.url() === `${base}/api/store/availability`)
      await page.goto(base, { waitUntil: 'domcontentloaded' })
      const gate = await availability
      await check(async () => expect(await gate.json()).toEqual({ catalogVisible: catalog }))
      await check(async () => expect(gate.headers()['cache-control']).toContain('no-store'))
      if (width === 1440) {
        const navigation = page.locator('.app-desktop-header nav').first()
        await check(() => expect(navigation.getByRole('link', { name: '实物商城', exact: true })).toHaveCount(0))
      } else {
        await check(() => expect(page.locator('.bottom-nav-bar').getByRole('link')).toHaveCount(4))
        await check(() => expect(page.locator('.bottom-nav-bar').getByRole('button', { name: '我的', exact: true })).toBeVisible())
      }
      await check(async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy())
      await page.screenshot({ path: `${output}/home-${catalog ? 'open' : 'closed'}-${width}.png`, fullPage: true })

      // This exercises the actual Next route; only the database-backed list response is a browser fixture.
      await page.route('**/api/store/products', route => route.fulfill({ json: { products: [] } }))
      const storeResponse = await page.goto(`${base}/store`, { waitUntil: 'domcontentloaded' })
      await check(async () => expect(storeResponse?.status()).toBe(catalog ? 200 : 404))
      await check(() => expect(page).toHaveTitle(`${catalog ? '材料包商城' : '页面未找到'} | 创探空间`))
      if (catalog) {
        await check(() => expect(page.getByRole('heading', { name: '商品正在准备中', exact: true })).toBeVisible())
        await check(() => expect(page.getByRole('link', { name: '我的订单', exact: true })).toBeVisible())
      }
      await check(async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy())
      await page.screenshot({ path: `${output}/store-${catalog ? 'open' : 'closed'}-${width}.png`, fullPage: true })

      await page.goto(`${base}/support`, { waitUntil: 'domcontentloaded' })
      await check(() => expect(page.getByRole('heading', { name: '创探空间客服', exact: true })).toBeVisible())
      await check(() => expect(page.getByRole('button', { name: '登录并联系客服', exact: true })).toBeVisible())
      await check(async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy())
      await page.screenshot({ path: `${output}/support-${catalog ? 'open' : 'closed'}-${width}.png`, fullPage: true })
      for (const path of ['/store/orders', '/profile', '/settings']) {
        const response = await context.request.get(`${base}${path}`, { maxRedirects: 0 })
        await check(async () => expect(response.status()).toBe(307))
        await check(async () => expect(new URL(response.headers().location, base).searchParams.get('next')).toBe(path))
      }
      await context.close()
    }
  }
  const unexpectedHttpErrors = httpErrors.filter(({ path, status }) => !(
    (path === '/store' && status === 404)
    || (path === '/api/announcements/active' && status === 500)
  ))
  const unexpectedConsoleErrors = consoleErrors.filter(message => !/^Failed to load resource: the server responded with a status of (404|500) \(/.test(message))
  await check(async () => expect(errors).toEqual([]))
  await check(async () => expect(unexpectedHttpErrors).toEqual([]))
  await check(async () => expect(unexpectedConsoleErrors).toEqual([]))
  await check(async () => expect(blocked).toEqual([]))
  console.info(JSON.stringify({ assertions, errors, consoleErrors, httpErrors, unexpectedHttpErrors, unexpectedConsoleErrors, blocked, screenshots: output }, null, 2))
} finally {
  await browser.close()
}

import { expect, test } from '@playwright/test'
import { skipVisitLoginPrompt } from '../visit-prompt'

test.beforeEach(async ({ page }) => skipVisitLoginPrompt(page))

const internalPages = [
  ['/design-system', 'Design System'],
  ['/ldraw-preview', 'LDraw 3D'],
  ['/migrate', 'pnpm db:push'],
] as const

for (const [path, marker] of internalPages) {
  test(`${path}: server status and browser output`, async ({ page, request }, testInfo) => {
    const development = testInfo.project.metadata.mode === 'development'
    const response = await request.get(path)
    expect(response.status()).toBe(development ? 200 : 404)
    const html = await response.text()
    if (development) expect(html).toContain(marker)
    else {
      expect(html).not.toContain(marker)
      expect(html).toMatch(/name="robots"[^>]*noindex/)
      // A public dev hostname must never enable a production build.
      expect((await request.get(path, { headers: { host: 'dev.steamx.cc' } })).status()).toBe(404)
      const rsc = await request.get(`${path}?_rsc=internal-check`, { headers: { RSC: '1' } })
      expect(rsc.status()).toBe(404)
      expect(await rsc.text()).not.toContain(marker)
    }
    const navigation = await page.goto(path)
    expect(navigation?.status()).toBe(development ? 200 : 404)
    if (!development) {
      await expect(page.getByRole('heading', { name: '这个页面没有找到' })).toBeVisible()
      await expect(page.locator('body')).not.toContainText(marker)
    } else {
      await expect(page.locator('body')).not.toContainText('Application error')
      await expect(page.locator('body')).not.toContainText('这个页面没有找到')
    }
    await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true })
  })
}

test('preview API blocks production before validation and retains development operations', async ({ request, baseURL }, testInfo) => {
  if (testInfo.project.metadata.mode === 'production') {
    for (const method of ['GET', 'POST', 'PATCH']) {
      for (const query of ['', '?model=3-hu-die.ldr', '?model=../invalid']) {
        const response = await request.fetch(`/api/ldraw-preview${query}`, {
          method, headers: { origin: baseURL! }, ...(method === 'GET' ? {} : { data: '{invalid' }),
        })
        expect(response.status()).toBe(404)
        expect(await response.json()).toEqual({ error: 'Not Found' })
        expect(response.headers()['x-robots-tag']).toContain('noindex')
      }
    }
  } else {
    const list = await request.get('/api/ldraw-preview')
    expect(list.status()).toBe(200)
    expect((await list.json()).total).toBeGreaterThan(0)
    const packed = await request.post('/api/ldraw-preview', { data: { ldrText: '0 Test\n3 4 0 0 0 10 0 0 0 10 0', modelName: 'test' } })
    expect(packed.status()).toBe(200)
    expect((await packed.json()).mpdText).toContain('0 FILE')
    for (const origin of [undefined, 'https://evil.example', 'http://127.0.0.1:1']) {
      expect((await request.patch('/api/ldraw-preview', { headers: origin ? { origin } : {}, data: {} })).status()).toBe(403)
    }
    expect((await request.patch('/api/ldraw-preview', { headers: { origin: baseURL! }, data: {} })).status()).toBe(400)
    const model = await request.get('/api/ldraw-preview?model=3-hu-die.ldr')
    expect(model.status()).toBe(200)
    expect((await model.json()).mpdText).toContain('0 FILE')
  }
})

test('catalog status/title/noindex and existing order authentication', async ({ page, request }, testInfo) => {
  const enabled = testInfo.project.metadata.catalog
  const response = await page.goto('/store')
  expect(response?.status()).toBe(enabled ? 200 : 404)
  await expect(page).toHaveTitle(`${enabled ? '材料包商城' : '页面未找到'} | 创探空间`)
  expect(await page.locator('meta[name="robots"]').first().getAttribute('content')).toContain('noindex')
  for (const path of ['/store/orders', '/store/orders/11111111-1111-4111-8111-111111111111']) {
    const result = await request.get(path, { maxRedirects: 0 })
    expect(result.status()).toBe(307)
    expect(new URL(result.headers().location, 'http://localhost').searchParams.get('next')).toBe(path)
  }
  expect((await request.get('/api/store/orders')).status()).toBe(401)
  await page.screenshot({ path: testInfo.outputPath('store.png'), fullPage: true })
})

test('normal lesson step and BOM remain available', async ({ request }) => {
  const step = await request.get('/api/courses/ldraw-step?model=3-hu-die.mpd&step=0')
  expect(step.status()).toBe(200)
  expect(await step.text()).toContain('0 FILE')
  expect(step.headers()['x-ldraw-step-count']).toBe('10')
  const bom = await request.get('/api/courses/ldraw-bom?model=3-hu-die.mpd')
  expect(bom.status()).toBe(200)
  expect(await bom.json()).toMatchObject({ stepCount: 10, partCount: 35 })
})

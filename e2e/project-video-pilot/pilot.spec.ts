import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { skipVisitLoginPrompt } from '../visit-prompt'

// Synthetic 140-second silent grey video: tests native media seeking, not the experiment.
// ffmpeg -f lavfi -i color=c=gray:s=160x90:r=1 -t 140 -an -c:v libx264 -pix_fmt yuv420p -g 1 -movflags +faststart seek-fixture.mp4
const videoBytes = readFileSync('e2e/project-video-pilot/seek-fixture.mp4')
const mediaPattern = '**/api/assets/**/*.mp4?*'
const moments: [string, number][] = [['00:03 材料总览', 3], ['00:06 绕线', 6], ['00:49 刮漆', 49], ['01:20 底座', 80], ['01:34 接线', 94], ['02:04 试转', 124]]

async function serveVideo(route: Route) {
  const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '')
  const start = range ? Number(range[1]) : 0
  const end = range?.[2] ? Math.min(Number(range[2]), videoBytes.length - 1) : videoBytes.length - 1
  await route.fulfill({
    status: range ? 206 : 200,
    contentType: 'video/mp4',
    headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${videoBytes.length}` } : {}) },
    body: videoBytes.subarray(start, end + 1),
  })
}

test.beforeEach(async ({ page }) => {
  await skipVisitLoginPrompt(page)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue()
    return route.abort()
  })
  await page.route(mediaPattern, serveVideo)
  await page.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ddd"/></svg>',
  }))
})

function visibleVideo(page: Page) { return page.locator('video:visible') }
async function expectTime(video: Locator, seconds: number) {
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(seconds, 0)
}

test('1301 preparation precedes tutorial; native chapter seeking preserves pause/play and never completes', async ({ page }, info) => {
  const mutations: string[] = []
  page.on('request', req => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && new URL(req.url()).pathname.startsWith('/api/')) mutations.push(req.url()) })
  await page.goto('/project/1301')
  await expect(page.getByRole('heading', { name: '自制电动机', exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '制作视频', exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('观看实验视频')
  await expect(page.locator('body')).not.toContainText('1 个步骤')
  await expect(page.locator('body')).not.toContainText('1 项材料')
  await expect(page.locator('body')).not.toContainText('对应实验材料包')
  const suffix = info.project.name === 'mobile' ? '-mobile' : ''
  const materials = page.locator(`#project-materials${suffix}`)
  await expect(materials).toContainText('尺寸、线径和电池规格尚未核实')
  await expect(materials.locator('li')).toHaveCount(10)
  const video = visibleVideo(page)
  await expect(video).toHaveCount(1)
  await expect(video.locator('source')).toHaveAttribute('src', /^\/api\/assets\/.*\.mp4\?exp=\d+&sig=[a-f0-9]{64}$/)
  expect(await materials.evaluate((element) => {
    const visible = [...document.querySelectorAll('video')].find(item => item.getClientRects().length > 0)!
    return element.compareDocumentPosition(visible) & Node.DOCUMENT_POSITION_FOLLOWING
  })).toBeTruthy()
  await expect(page.locator(`#project-steps${suffix}`)).toContainText('视频时长约 2 分 17 秒（不是制作耗时）')
  await expect(page.locator(`#project-steps${suffix}`)).toContainText('一头半刮，另一头完全刮干净')
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0)
  for (const [label, seconds] of moments) {
    await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).click()
    await expectTime(video, seconds)
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)
  }
  await expect(page.getByRole('link', { name: '步骤', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '00:49 刮漆' }).filter({ visible: true }).click()
  await video.evaluate((element: HTMLVideoElement) => element.play())
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(49.2)
  await page.getByRole('button', { name: '00:49 刮漆' }).filter({ visible: true }).click()
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false)
  await video.evaluate((element: HTMLVideoElement) => element.pause())
  await page.getByRole('button', { name: '01:20 底座' }).filter({ visible: true }).click()
  await expectTime(video, 80)
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.currentTime = element.duration - 0.2
    const ended = new Promise<void>(resolve => element.addEventListener('ended', () => resolve(), { once: true }))
    await element.play()
    await ended
  })
  expect(mutations).toEqual([])
  await expect(page.getByText('登录记录项目', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await materials.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('1301-preparation-and-video.png'), fullPage: true })
})

test('latest click before metadata is applied once loading finishes', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(mediaPattern, async route => { await gate; await serveVideo(route) })
  await page.goto('/project/1301', { waitUntil: 'domcontentloaded' })
  const video = visibleVideo(page)
  expect(await video.evaluate((element: HTMLVideoElement) => element.readyState)).toBe(0)
  await page.getByRole('button', { name: '00:49 刮漆' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: '01:34 接线' }).filter({ visible: true }).click()
  await expect(page.getByRole('status').filter({ visible: true, hasText: '随后定位到 01:34' })).toBeVisible()
  release()
  await expectTime(video, 94)
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)
})

test('892 retains its four real actions, timestamps, reset and safety guidance', async ({ page }, info) => {
  await page.goto('/project/892')
  await expect(visibleVideo(page)).toHaveCount(1)
  const steps = page.locator(info.project.name === 'mobile' ? '#project-steps-mobile' : '#project-steps')
  await expect(steps.getByRole('heading', { name: /共 4 步/ })).toBeVisible()
  if (info.project.name === 'mobile') await steps.getByRole('button', { name: '全部展开' }).click()
  for (const text of ['两人配合准备', '第一次交叉', '第二次交叉', '让细链脱出', '10—16 秒', '16—24 秒', '不勒住手指', '先松开复位', '不要用力拽']) await expect(steps).toContainText(text)
  await expect(page.getByRole('button', { name: '00:49 刮漆' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('892-mixed-content.png'), fullPage: true })
})

test('non-target single-step projects keep their instructions and permission gate', async ({ page }, info) => {
  for (const [id, title] of [[501, '折纸带'], [502, '观看实验视频']] as const) {
    await page.goto(`/project/${id}`)
    const steps = page.locator(info.project.name === 'mobile' ? '#project-steps-mobile' : '#project-steps')
    await expect(steps).toContainText('共 1 步')
    await expect(steps).toContainText(title)
    await expect(visibleVideo(page)).toHaveCount(1)
  }
  const response = await page.goto('/project/503')
  expect(response?.status()).toBe(404)
})

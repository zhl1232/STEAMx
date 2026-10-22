import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    ;(window as any).kwsObservations = []
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', ({ data }) => {
          if (data.type === 'result') (window as any).kwsObservations.push({ ...data, receivedAt: Date.now() })
        })
      }
    }
  })
})

async function start(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible({ timeout: 60000 })
}

test('loads real Chinese WASM/model beside the 3D workspace and releases on exit', async ({ page }) => {
  const requests: { url: string; method: string }[] = []
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }))
  await start(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 })
  expect(requests.some((r) => r.url.endsWith('.wasm'))).toBe(true)
  expect(requests.some((r) => r.url.endsWith('.data'))).toBe(true)
  expect(requests.filter((r) => r.url.includes('/api/tutor/')).every((r) => r.method === 'GET' && r.url.includes('course-control?'))).toBe(true)
  await page.getByRole('button', { name: '退出语音搭建' }).click()
  await expect(page.getByRole('button', { name: '开启', exact: true })).toBeVisible()
  await expect.poll(() => page.workers().length).toBe(0)
})

test('shows asset failure and capability failure with manual controls available', async ({ page }) => {
  await page.route('**/*.data', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('失败', { timeout: 60000 })
  await expect(page.getByRole('button', { name: '手动下一页' })).toBeEnabled()
  await page.unroute('**/*.data')
  await page.reload()
  await page.evaluate(() => { Object.defineProperty(window, 'AudioWorkletNode', { value: undefined }) })
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('不支持')
})

test('keeps healthy hidden capture; preemption, pagehide and unmount release it', async ({ page }) => {
  await start(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
  await page.evaluate(() => (window as any).kwsFixture.preempt())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('小迪正在使用语音')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('页面已离开')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
  await page.getByRole('button', { name: '挂载切换' }).click()
  await expect.poll(() => page.workers().length).toBe(0)
})

for (const corpus of ['', 'clear/']) test(`actual synthetic Mandarin fixed commands and rejection corpus (${corpus || 'normal'})`, async ({ page }, testInfo) => {
  test.setTimeout(180000)
  await start(page)
  const results = []
  for (const [name, expectedDelta] of [['next', 1], ['next_page', 1], ['previous', -1], ['previous_page', -1],
    ['unknown', 0], ['bare', 0], ['negative', 0], ['negative_prefix', 0], ['quote', 0], ['quote_suffix', 0], ['double', 0], ['question', 0]] as const) {
    await page.evaluate(() => (window as any).kwsFixture.resetStep())
    await expect(page.getByTestId('step')).toHaveText('4')
    const before = Number(await page.getByTestId('step').textContent())
    await page.evaluate(async (name) => { (window as any).kwsObservations = []; await (window as any).kwsFixture.play(name) }, corpus + name)
    await page.waitForTimeout(1500)
    const after = Number(await page.getByTestId('step').textContent())
    const observations = await page.evaluate(() => (window as any).kwsObservations)
    results.push({ name, expectedDelta, actualDelta: after - before, observations })
  }
  const before = Number(await page.getByTestId('step').textContent())
  await page.evaluate((prefix) => (window as any).kwsFixture.play(prefix + 'next', prefix + 'previous'), corpus)
  await page.waitForTimeout(1500)
  results.push({ name: 'overlapping-next-previous', expectedDelta: 0, actualDelta: Number(await page.getByTestId('step').textContent()) - before })
  await testInfo.attach('synthetic-mandarin-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
  for (const result of results) expect.soft(result.actualDelta, result.name).toBe(result.expectedDelta)
  await page.evaluate(async (prefix) => { (window as any).kwsObservations = []; await (window as any).kwsFixture.play(prefix + 'pause') }, corpus)
  await page.waitForTimeout(1500)
  await testInfo.attach('pause-observations', { body: JSON.stringify(await page.evaluate(() => (window as any).kwsObservations)), contentType: 'application/json' })
  await expect.soft(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('已暂停并关闭麦克风')
  // Continue lifecycle/exit checks even when the acoustic pause acceptance fails.
  if (await page.getByRole('button', { name: '暂停', exact: true }).isVisible()) await page.getByRole('button', { name: '暂停', exact: true }).click()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
  await page.evaluate(async (prefix) => { (window as any).kwsObservations = []; await (window as any).kwsFixture.play(prefix + 'exit') }, corpus)
  await page.waitForTimeout(1500)
  await testInfo.attach('exit-observations', { body: JSON.stringify(await page.evaluate(() => (window as any).kwsObservations)), contentType: 'application/json' })
  await expect(page.getByRole('button', { name: '开启', exact: true })).toBeVisible()
})

test('optional wall-clock endurance beside 3D', async ({ page }, testInfo) => {
  const duration = Number(process.env.BUILDING_KWS_SOAK_MS || 0)
  test.skip(duration < 60000, 'Explicit real elapsed duration and synthetic input required.')
  test.setTimeout(duration + 120000)
  let eligibilityRequests = 0
  page.on('request', (request) => { if (request.url().includes('/api/tutor/speech/course-control?')) { expect(request.method()).toBe('GET'); eligibilityRequests++ } })
  await start(page)
  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')
  const browserSession = await page.context().browser()!.newBrowserCDPSession()
  const targets = await browserSession.send('Target.getTargets')
  const workerTarget = targets.targetInfos.find((target: { type: string; url: string }) => target.type === 'worker' && target.url.endsWith('/kws-worker.js'))!
  const attached = await browserSession.send('Target.attachToTarget', { targetId: workerTarget.targetId, flatten: false })
  let messageId = 0
  const workerHeap = () => new Promise<Record<string, number>>((resolve, reject) => {
    const id = ++messageId
    const timeout = setTimeout(() => { browserSession.off('Target.receivedMessageFromTarget', receive); reject(new Error('Worker heap measurement timeout')) }, 5000)
    const receive = (event: { sessionId: string; message: string }) => {
      const reply = JSON.parse(event.message)
      if (event.sessionId !== attached.sessionId || reply.id !== id) return
      clearTimeout(timeout)
      browserSession.off('Target.receivedMessageFromTarget', receive)
      if (reply.error) reject(new Error(reply.error.message)); else resolve(reply.result)
    }
    browserSession.on('Target.receivedMessageFromTarget', receive)
    void browserSession.send('Target.sendMessageToTarget', { sessionId: attached.sessionId, message: JSON.stringify({ id, method: 'Runtime.getHeapUsage' }) }).catch(reject)
  })
  await page.evaluate(() => {
    const stats = { count: 0, maxMs: 0 }
    ;(window as any).kwsLongTasks = stats
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) { stats.count++; stats.maxMs = Math.max(stats.maxMs, entry.duration) } }).observe({ type: 'longtask' })
  })
  const began = Date.now()
  const samples = []
  let cycle = 0
  while (Date.now() - began < duration) {
    const phrase = ['next', 'previous', 'unknown'][cycle++ % 3]
    const before = Number(await page.getByTestId('step').textContent())
    await page.evaluate(() => { (window as any).kwsObservations = [] })
    await page.evaluate((phrase) => (window as any).kwsFixture.play(phrase), phrase)
    await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as any).kwsObservations.length)).toBeGreaterThan(0)
    const latencyMs = await page.evaluate(() => (window as any).kwsObservations.map((entry: {receivedAt: number; capturedAt: number}) => entry.receivedAt - entry.capturedAt))
    const actualDelta = Number(await page.getByTestId('step').textContent()) - before
    // Endurance measures elapsed stability and memory; acoustic acceptance is a separate failing/passing gate above.
    expect([0, phrase === 'next' ? 1 : phrase === 'previous' ? -1 : 0]).toContain(actualDelta)
    const canvas = await page.locator('canvas').first().boundingBox()
    if (canvas) {
      await page.mouse.move(canvas.x + canvas.width * 0.4, canvas.y + canvas.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.5, { steps: 10 })
      await page.mouse.up()
    }
    const heap = await workerHeap()
    expect(heap.backingStorageSize).toBeLessThan(300 * 1024 * 1024)
    const metrics = await session.send('Performance.getMetrics')
    samples.push({ elapsedMs: Date.now() - began, phrase, actualDelta, latencyMs, workerHeap: heap, metrics: metrics.metrics.filter((m: { name: string }) => ['JSHeapUsedSize', 'JSHeapTotalSize', 'TaskDuration'].includes(m.name)) })
    await page.evaluate(() => { (window as any).kwsObservations = [] }) // Do not accumulate test instrumentation either.
    await page.waitForTimeout(3000)
  }
  if (duration >= 260000) expect(eligibilityRequests).toBeGreaterThanOrEqual(2)
  await testInfo.attach('wall-clock-endurance', { body: JSON.stringify({ elapsedMs: Date.now() - began, eligibilityRequests, samples, longTasks: await page.evaluate(() => (window as any).kwsLongTasks) }, null, 2), contentType: 'application/json' })
  await page.getByRole('button', { name: '退出语音搭建' }).click()
  await expect.poll(() => page.workers().length).toBe(0)
})

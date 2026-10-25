import { writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import cases from './cases.json'
import { parseBuildingVoiceCommand } from '../../lib/courses/building-voice-commands'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', downlink: 10, saveData: false, type: 'ethernet' } })
    const NativeWorker = window.Worker
    ;(window as any).voiceObservations = []
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', ({ data }) => {
          if (data.type === 'result') (window as any).voiceObservations.push({ ...data, receivedAt: Date.now() })
        })
      }
    }
  })
})
async function start(page: Page) {
  await page.goto('/')
  expect(await page.evaluate(() => (window as any).voiceFixture.microphoneRequests)).toBe(0)
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(await page.evaluate(() => (window as any).voiceFixture.microphoneRequests)).toBe(0)
  await page.getByTestId('voice-toggle').click()
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible({ timeout: 60000 })
}
async function resume(page: Page) {
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status), {timeout:120000}).toBe('ready')
  const button = page.getByRole('button', { name: '继续', exact: true })
  await (await button.isVisible() ? button : page.getByRole('button', { name: '开启', exact: true })).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible({ timeout: 60000 })
}
async function play(page: Page, file: string) {
  await page.evaluate(async (name) => { (window as any).voiceObservations = []; await (window as any).voiceFixture.play(name) }, file.replace(/\.wav$/, ''))
  await page.waitForTimeout(1500)
}
test('loads pinned WASM/model, exercises repeat open/close and keeps audio off the network', async ({ page }) => {
  const requests: {url: string; method: string}[] = []
  page.on('request', r => requests.push({url:r.url(),method:r.method()}))
  await start(page)
  await expect(page.locator('canvas').first()).toBeVisible()
  for (let i=0;i<3;i++) {
    await expect(page.locator('[data-building-voice-controls]').getByRole('status')).not.toContainText('失败')
    await page.getByRole('button', {name:'退出语音搭建'}).click()
    await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status)).toBe('ready')
    expect(page.workers().length).toBe(2) // One standby model; capture and recognizer have been released.
    expect(await page.evaluate(()=>(window as any).voiceFixture.trackState)).toBe('ended')
    if(i<2)await resume(page)
  }
  expect(requests.some(r=>r.url.startsWith('http://127.0.0.1:4186/') && r.url.endsWith('/model.tar.gz'))).toBe(true)
  expect(requests.some(r=>r.url.startsWith('http://127.0.0.1:4186/') && r.url.endsWith('/vosk.js'))).toBe(true)
  expect(requests.filter(r=>r.method!=='GET')).toEqual([])
})
test('failed download and missing capability stay silent until settings are opened', async ({ page }) => {
  const attempted: string[] = []
  page.on('request', request => { if (request.url().endsWith('/model.tar.gz')) attempted.push(request.url()) })
  await page.route('**/model.tar.gz',route=>route.abort())
  await page.goto('/')
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status), {timeout:30000}).toBe('error')
  expect(attempted).toHaveLength(2)
  expect(attempted[0]).toMatch(/^http:\/\/127\.0\.0\.1:4186\//)
  expect(attempted[1]).toBe('http://127.0.0.1:4185/courses/vosk/v1/model.tar.gz')
  await expect(page.getByTestId('voice-toggle')).not.toBeVisible()
  await expect(page.getByRole('status').filter({hasText:'失败'})).not.toBeVisible()
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
  await page.getByRole('button',{name:'语音设置',exact:true}).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('失败')
  await expect(page.getByRole('button',{name:'手动下一页'})).toBeEnabled()
  await expect.poll(()=>page.workers().length).toBe(0)
  await page.unroute('**/model.tar.gz')
  await page.getByRole('button',{name:'重试语音准备'}).click()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
  await page.reload()
  await page.evaluate(()=>Object.defineProperty(window,'AudioWorkletNode',{value:undefined}))
  await page.getByRole('button',{name:'语音设置',exact:true}).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('不支持')
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
})
test('healthy hidden capture continues; actual interruption, page exit and tutor preemption require a click', async ({ page }) => {
  await start(page)
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))})
  await page.waitForTimeout(750) // Let the capture heartbeat run through a hidden-page interval.
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible()
  expect(await page.evaluate(()=>(window as any).voiceFixture.trackState)).toBe('live')
  await page.evaluate(()=>(window as any).voiceFixture.interrupt())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('中断')
  expect(await page.evaluate(()=>(window as any).voiceFixture.trackState)).toBe('ended')
  await resume(page)
  await expect(page.getByTestId('step')).toHaveText('1')
  await page.evaluate(()=>(window as any).voiceFixture.preempt())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('小迪正在使用语音')
  await resume(page)
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')))
  await expect.poll(()=>page.workers().length).toBe(0)
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')))
  await resume(page)
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect.poll(()=>page.workers().length).toBe(0)
})
test('lesson playback pauses capture and an explicit restart pauses that media', async ({ page }) => {
  await start(page)
  await page.getByTestId('lesson-audio').evaluate((element: HTMLAudioElement)=>element.play())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('课程媒体正在播放')
  expect(await page.evaluate(()=>(window as any).voiceFixture.trackState)).toBe('ended')
  await resume(page)
  expect(await page.getByTestId('lesson-audio').evaluate((element: HTMLAudioElement)=>element.paused)).toBe(true)
  await page.getByRole('button',{name:'手动下一页'}).click()
  await expect(page.getByTestId('step')).toHaveText('2')
})
test('@acoustic manual navigation invalidates a command already being spoken', async ({ page }) => {
  await start(page)
  const playback=page.evaluate(()=>(window as any).voiceFixture.play('normal-next'))
  await page.waitForTimeout(1300)
  await page.getByRole('button',{name:'手动下一页'}).click()
  await playback;await page.waitForTimeout(1800)
  await expect(page.getByTestId('step')).toHaveText('2')
})
test('@acoustic strict synthetic acceptance retains every failure including replay and overlap', async ({ page },testInfo) => {
  test.setTimeout(900000)
  await start(page)
  const results=[]
  for(const item of cases){
    if(!(await page.getByText('语音搭建 · 正在听').isVisible()))await resume(page)
    await page.evaluate(()=>(window as any).voiceFixture.resetStep())
    await expect(page.getByTestId('step')).toHaveText('4')
    await play(page,item.file)
    const step=Number(await page.getByTestId('step').textContent())
    const listening=await page.getByText('语音搭建 · 正在听').isVisible()
    const paused=await page.getByRole('button',{name:'继续',exact:true}).isVisible()
    const idle=await page.getByRole('button',{name:'开启',exact:true}).isVisible()
    const observations=await page.evaluate(()=>(window as any).voiceObservations)
    const feedback=idle?null:await page.locator('[data-building-voice-controls]').getByRole('status').textContent()
    const actual=step===5?'next':step===3?'previous':paused?(feedback?.startsWith('已暂停并关闭麦克风')?'pause':'engine-error'):idle?'exit':null
    results.push({...item,actual,step,listening,feedback,observations,rawParsed:observations.map((r:any)=>parseBuildingVoiceCommand(r.observation.text))})
    writeFileSync(testInfo.outputPath('full-synthetic-corpus.json'),JSON.stringify(results,null,2))
    console.log(item.id,actual===item.expected?'PASS':'FAIL',actual)
    expect.soft(actual,item.id).toBe(item.expected)
  }
  await testInfo.attach('full-synthetic-corpus',{body:JSON.stringify(results,null,2),contentType:'application/json'})
})


test('cold preparation waits for the course; hot cache avoids big downloads and never opens the mic', async ({ page }, testInfo) => {
  const downloads: string[] = []
  page.on('request', request => { if (/\/(model\.tar\.gz|vosk\.js)$/.test(request.url())) downloads.push(request.url()) })
  let unblock!: () => void
  const blocked = new Promise<void>(resolve => { unblock = resolve })
  await page.route('**/api/courses/ldraw-step?*', async route => { await blocked; await route.continue().catch(()=>{}) })
  await page.goto('/')
  await page.getByRole('button',{name:'手动下一页'}).click()
  await expect(page.getByTestId('step')).toHaveText('2')
  const slotBefore = await page.locator('[data-voice-entry-slot]').boundingBox()
  await page.waitForTimeout(2500)
  expect(downloads).toEqual([])
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
  unblock()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  const slotAfter = await page.locator('[data-voice-entry-slot]').boundingBox()
  expect(slotAfter).toEqual(slotBefore)
  expect(downloads.filter(url=>url.endsWith('model.tar.gz'))).toHaveLength(1)
  expect(downloads.filter(url=>url.endsWith('vosk.js'))).toHaveLength(1)
  expect(await page.evaluate(()=>(window as any).voiceFixture.preparation)).toMatchObject({status:'ready',persisted:true,fromCache:false})
  await expect(page.locator('[data-building-voice-controls]')).not.toBeVisible()
  await page.reload()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(await page.evaluate(()=>(window as any).voiceFixture.preparation)).toMatchObject({status:'ready',fromCache:true})
  expect(downloads).toHaveLength(2)
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect.poll(()=>page.workers().length).toBe(0)
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(downloads).toHaveLength(2)
  await testInfo.attach('preparation-requests',{body:JSON.stringify(downloads),contentType:'application/json'})
})

test('saving data leaves voice silent, with an explicit preparation path in settings', async ({ page }) => {
  await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:{effectiveType:'3g',downlink:1,saveData:true,type:'cellular'}}))
  const downloads: string[] = []
  page.on('request',request=>{if(/\/(model\.tar\.gz|vosk\.js)$/.test(request.url()))downloads.push(request.url())})
  await page.goto('/')
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status),{timeout:30000}).toBe('deferred')
  await page.waitForTimeout(2500)
  expect(downloads).toEqual([])
  await expect(page.getByTestId('voice-toggle')).not.toBeVisible()
  await expect(page.locator('[data-building-voice-controls]')).not.toBeVisible()
  await page.getByRole('button',{name:'语音设置',exact:true}).click()
  await page.getByRole('button',{name:'准备语音（约 50 MB）'}).click()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(downloads).toHaveLength(2)
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
})

test('leaving during download cancels the owner and a later visit can prepare', async ({ page }) => {
  let unblock!: () => void
  const blocked = new Promise<void>(resolve=>{unblock=resolve})
  await page.route('**/model.tar.gz',async route=>{await blocked;await route.continue().catch(()=>{})})
  await page.goto('/')
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status),{timeout:30000}).toBe('downloading')
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect.poll(()=>page.workers().length).toBe(0)
  unblock();await page.unroute('**/model.tar.gz')
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
})

test('downloaded bytes alone do not expose a voice start button after engine failure', async ({ page }) => {
  await page.route('**/vosk-worker.js',route=>route.fulfill({contentType:'application/javascript',body:"self.onmessage=()=>self.postMessage({type:'error'})"}))
  await page.goto('/')
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status),{timeout:30000}).toBe('error')
  await expect(page.getByTestId('voice-toggle')).not.toBeVisible()
  await expect(page.locator('[data-building-voice-controls]')).not.toBeVisible()
  await expect.poll(()=>page.workers().length).toBe(0)
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
})

test('silent initialization leaves the actual 3D workspace navigable', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const metrics = { frames: 0, maxFrameGapMs: 0, longTasks: 0, longTaskMs: 0 }
    ;(window as any).preparationPerformance = metrics
    let previous = performance.now()
    function frame(now: number) { metrics.frames++; metrics.maxFrameGapMs = Math.max(metrics.maxFrameGapMs, now - previous); previous = now; requestAnimationFrame(frame) }
    requestAnimationFrame(frame)
    new PerformanceObserver(list => { for (const entry of list.getEntries()) { metrics.longTasks++; metrics.longTaskMs += entry.duration } }).observe({ type: 'longtask' })
  })
  await page.goto('/')
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.preparation.status),{timeout:30000,intervals:[50]}).toBe('initializing')
  await expect(page.locator('canvas').first()).toBeVisible()
  const clickedAt = Date.now()
  await page.getByRole('button',{name:'手动下一页'}).click()
  await expect(page.getByTestId('step')).toHaveText('2')
  const navigationMs = Date.now() - clickedAt
  await expect(page.getByTestId('voice-toggle')).toBeVisible({timeout:120000})
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
  const metrics = await page.evaluate(()=>(window as any).preparationPerformance)
  await testInfo.attach('preparation-performance',{body:JSON.stringify({navigationMs,...metrics,note:'Linux Chromium / SwiftShader; rAF is not rendered 3D FPS. No phone or physical microphone.'}),contentType:'application/json'})
  await page.screenshot({path:testInfo.outputPath('ready-desktop.png')})
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('button',{name:'语音设置',exact:true}).click()
  await expect(page.getByRole('button',{name:'开启',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({path:testInfo.outputPath('ready-mobile-viewport.png')})
})

test('Android-style fast estimates without physical network type still prepare silently', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' })
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', downlink: 10, saveData: false } })
  })
  await page.goto('/')
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(await page.evaluate(() => (window as any).voiceFixture.microphoneRequests)).toBe(0)
  await expect(page.getByRole('button', { name: '手动下一页' })).toBeEnabled()
})

test('a service worker update preserves the old valid voice cache and initializes without CDN downloads', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }))
  const remote: string[] = []
  page.on('request', r => { if (r.url().startsWith('http://127.0.0.1:4186/')) remote.push(r.url()) })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as any).voiceFixture.preparation.status), { timeout: 30000 }).toBe('deferred')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw-legacy-fixture.js')
    await navigator.serviceWorker.ready
    const cache = await caches.open('steamx-building-vosk-v1')
    for (const name of ['model.tar.gz', 'vosk.js']) {
      const url = `/courses/vosk/v1/${name}`
      await cache.put(url, await fetch(url))
    }
    await caches.open('steamx-pwa-v0')
    await caches.open('unrelated-feature')
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
  })
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('/sw.js')
  // skipWaiting can replace the controller while activate's waitUntil is still
  // running. Cache cleanup is guaranteed only after the activated transition.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated')
  expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['steamx-building-vosk-v1', 'unrelated-feature']))
  expect(await page.evaluate(() => caches.keys())).not.toContain('steamx-pwa-v0')
  await page.getByRole('button', { name: '语音设置', exact: true }).click()
  await page.getByRole('button', { name: '准备语音（约 50 MB）' }).click()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(await page.evaluate(() => (window as any).voiceFixture.preparation.fromCache)).toBe(true)
  expect(remote).toEqual([])
  expect(await page.evaluate(() => (window as any).voiceFixture.microphoneRequests)).toBe(0)
  await page.reload()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(remote).toEqual([])
  await testInfo.attach('service-worker-cache-upgrade', { body: JSON.stringify(await page.evaluate(async () => ({
    state: navigator.serviceWorker.controller?.state, caches: await caches.keys(), preparation: (window as any).voiceFixture.preparation,
  }))), contentType: 'application/json' })
})

test('a CDN response without CORS uses the same verified public file; hot cache avoids both sources', async ({ page }) => {
  await page.route('**/courses/vosk/v2/assets.js', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace('/model.tar.gz"', '/model.tar.gz?cors=deny"') })
  })
  await page.goto('/')
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(await page.evaluate(() => (window as any).voiceFixture.preparation.sources)).toEqual(['same-origin', 'cdn'])
  expect(await page.evaluate(() => (window as any).voiceFixture.microphoneRequests)).toBe(0)
  await expect(page.getByRole('button', { name: '手动下一页' })).toBeEnabled()
  const downloads: string[] = []
  page.on('request', request => { if (/\/(model\.tar\.gz|vosk\.js)(\?|$)/.test(request.url())) downloads.push(request.url()) })
  await page.reload()
  await expect(page.getByTestId('voice-toggle')).toBeVisible({ timeout: 120000 })
  expect(await page.evaluate(() => (window as any).voiceFixture.preparation.sources)).toEqual(['cache', 'cache'])
  expect(downloads).toEqual([])
})

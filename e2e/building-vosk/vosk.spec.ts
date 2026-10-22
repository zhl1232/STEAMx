import { writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import cases from './cases.json'
import { parseBuildingVoiceCommand } from '../../lib/courses/building-voice-commands'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page.getByText('语音搭建 · 正在听')).toBeVisible({ timeout: 60000 })
}
async function resume(page: Page) {
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
    await play(page, 'normal-next.wav')
    await expect(page.locator('[data-building-voice-controls]').getByRole('status')).not.toContainText('失败')
    await page.getByRole('button', {name:'退出语音搭建'}).click()
    await expect.poll(()=>page.workers().length).toBe(0)
    expect(await page.evaluate(()=>(window as any).voiceFixture.trackState)).toBe('ended')
    if(i<2)await resume(page)
  }
  expect(requests.some(r=>r.url.endsWith('/vosk/v1/model.tar.gz'))).toBe(true)
  expect(requests.some(r=>r.url.endsWith('/vosk/v1/vosk.js'))).toBe(true)
  expect(requests.filter(r=>r.method!=='GET')).toEqual([])
})
test('failed download and missing capability leave manual controls usable', async ({ page }) => {
  await page.route('**/model.tar.gz',route=>route.abort())
  await page.goto('/')
  await page.getByRole('button',{name:'开启',exact:true}).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('失败',{timeout:60000})
  await expect(page.getByRole('button',{name:'手动下一页'})).toBeEnabled()
  await expect.poll(()=>page.workers().length).toBe(0)
  await page.unroute('**/model.tar.gz');await page.reload()
  await page.evaluate(()=>Object.defineProperty(window,'AudioWorkletNode',{value:undefined}))
  await page.getByRole('button',{name:'开启',exact:true}).click()
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('不支持')
  expect(await page.evaluate(()=>(window as any).voiceFixture.microphoneRequests)).toBe(0)
})
test('healthy hidden capture continues; actual interruption, page exit and tutor preemption require a click', async ({ page }) => {
  await start(page)
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))})
  await play(page,'normal-next.wav')
  await expect(page.getByTestId('step')).toHaveText('2')
  await page.evaluate(()=>(window as any).voiceFixture.interrupt())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('中断')
  await expect.poll(()=>page.workers().length).toBe(0)
  await resume(page)
  await play(page,'normal-previous.wav')
  await expect(page.getByTestId('step')).toHaveText('1')
  await page.evaluate(()=>(window as any).voiceFixture.preempt())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('小迪正在使用语音')
  await resume(page)
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')))
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('页面已离开')
  await resume(page)
  await page.getByRole('button',{name:'挂载切换'}).click()
  await expect.poll(()=>page.workers().length).toBe(0)
})
test('lesson playback pauses capture and an explicit restart pauses that media', async ({ page }) => {
  await start(page)
  await page.getByTestId('lesson-audio').evaluate((element: HTMLAudioElement)=>element.play())
  await expect(page.locator('[data-building-voice-controls]').getByRole('status')).toContainText('课程媒体正在播放')
  await expect.poll(()=>page.workers().length).toBe(0)
  await resume(page)
  expect(await page.getByTestId('lesson-audio').evaluate((element: HTMLAudioElement)=>element.paused)).toBe(true)
  await play(page,'normal-next.wav')
  await expect(page.getByTestId('step')).toHaveText('2')
})
test('manual navigation invalidates a command already being spoken', async ({ page }) => {
  await start(page)
  const playback=page.evaluate(()=>(window as any).voiceFixture.play('normal-next'))
  await page.waitForTimeout(1300)
  await page.getByRole('button',{name:'手动下一页'}).click()
  await playback;await page.waitForTimeout(1800)
  await expect(page.getByTestId('step')).toHaveText('2')
})
test('strict synthetic acoustic acceptance retains every failure including replay and overlap', async ({ page },testInfo) => {
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

// Production transport + real engine readiness. No login, audio capture or command execution.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const reportPath = process.env.BUILDING_VOICE_LOADING_REPORT || '.tmp/building-voice-loading.json'
const report = { origin: 'https://steam.bj.cn', startedAt: new Date().toISOString(), checks: [], microphoneRequests: 0, requests: [], failures: [] }
const isVoiceResource = url => /^https:\/\/(assets\.steamx\.cc|steam\.bj\.cn)\/courses\/vosk\/.+\/(model\.tar\.gz|vosk\.js)$/.test(url)
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true })
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.__voiceMicRequests = 0
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__voiceMicRequests++; throw new Error('This probe must never request a microphone') }
  })
  page.on('response', response => {
    if (isVoiceResource(response.url())) report.requests.push({ url: response.url(), status: response.status(), cors: response.headers()['access-control-allow-origin'] ?? null })
  })
  page.on('requestfailed', request => { if (isVoiceResource(request.url())) report.failures.push({ url: request.url(), error: request.failure()?.errorText }) })
  const response = await page.goto(report.origin, { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (!response?.ok() || new URL(page.url()).origin !== report.origin) throw new Error('Production page unavailable or unexpected redirect')
  let coldRequests = 0
  for (const label of ['cold', 'warm']) {
    const result = await page.evaluate(() => new Promise((resolve, reject) => {
      const started = performance.now()
      const download = new Worker('/courses/vosk/v2/prepare-worker.js')
      let engine
      let timer
      const finish = (error, value) => { clearTimeout(timer); download.terminate(); engine?.terminate(); error ? reject(new Error(error)) : resolve(value) }
      timer = setTimeout(() => finish('Download deadline'), 600000)
      download.onerror = () => finish('Preparation worker failed')
      download.onmessage = ({ data }) => {
        if (data.type === 'error') { finish(`Preparation ${data.code}`); return }
        if (data.type !== 'cached') return
        const downloadedMs = performance.now() - started
        download.terminate(); clearTimeout(timer)
        timer = setTimeout(() => finish('Initialization deadline'), 120000)
        engine = new Worker('/courses/vosk/v1/vosk-worker.js')
        engine.onerror = () => finish('Engine worker failed')
        engine.onmessage = ({ data: reply }) => {
          if (reply.type === 'error') finish('Engine initialization failed')
          if (reply.type === 'ready') finish(null, { fromCache: data.fromCache, persisted: data.persisted, sources: data.sources, downloadedMs, totalMs: performance.now() - started })
        }
        engine.postMessage({ type: 'init', modelBytes: data.modelBytes, runtimeBytes: data.runtimeBytes }, [data.modelBytes, data.runtimeBytes])
      }
      download.postMessage({ type: 'prepare', allowNetwork: true })
    }))
    report.checks.push({ label, ...result })
    if (label === 'cold' && result.fromCache) throw new Error('Fresh browser unexpectedly reused voice cache')
    if (label === 'cold') coldRequests = report.requests.length + report.failures.length
    if (label === 'warm' && !result.fromCache) throw new Error('Warm preparation did not reuse verified cache')
  }
  report.microphoneRequests = await page.evaluate(() => window.__voiceMicRequests)
  if (report.microphoneRequests !== 0) throw new Error('Preparation attempted microphone access')
  if (report.requests.length + report.failures.length !== coldRequests) throw new Error('Warm preparation fetched voice resources again')
  const cold = report.checks[0]
  if (cold.sources?.length !== 2 || cold.sources.some(source => !['cdn', 'same-origin'].includes(source))) throw new Error('Missing actual delivery source')
  report.cdnReady = cold.sources.every(source => source === 'cdn')
  report.note = report.cdnReady ? 'Both resources used CDN.' : 'Loading passed using original public same-origin files; CDN migration is incomplete.'
  report.passed = true
} catch (error) {
  report.passed = false; report.error = error.message; process.exitCode = 1
} finally {
  await browser?.close()
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

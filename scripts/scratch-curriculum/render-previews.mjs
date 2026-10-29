#!/usr/bin/env node
/** Capture actual reference-project stages; no database or remote asset publication. */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: node scripts/scratch-curriculum/render-previews.mjs [--base-url=http://localhost:3000] [--keys=s01-l01,s06-l08] [--delay-ms=1200]')
  process.exit(0)
}
const option = (name, fallback) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const base = new URL(option('base-url', 'http://localhost:3000'))
const delayMs = Number(option('delay-ms', '1200'))
if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 10000) throw new Error('delay-ms must be between 0 and 10000')
const allKeys = Array.from({ length: 6 }, (_, stage) => Array.from({ length: 8 }, (_, lesson) => `s${String(stage + 1).padStart(2, '0')}-l${String(lesson + 1).padStart(2, '0')}`)).flat()
const requested = option('keys', '').split(',').filter(Boolean)
const keys = requested.length ? requested : allKeys
if (keys.some(key => !allKeys.includes(key))) throw new Error('keys must name existing curriculum lessons')
const outDir = resolve(root, 'public/assets/course-previews/scratch')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
  await page.goto(new URL('/scratch/index.html?playerOnly=1&embed=1', base).href, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__scratchVm?.runtime?.renderer && window.__scratchVm.runtime.targets.some(target => target.isStage), { timeout: 90000 })
  for (const key of keys) {
    const project = await readFile(resolve(root, `public/courses/scratch-original/v1/${key}/reference.sb3`))
    await page.evaluate(async bytes => {
      const vm = window.__scratchVm
      vm.stopAll()
      await vm.loadProject(new Uint8Array(bytes).buffer)
      vm.start()
      vm.greenFlag()
    }, [...project])
    // Pen lessons need their short drawing sequence to finish before capture.
    const settleMs = /^s05-l0[5-8]$/.test(key) ? Math.max(delayMs, 3000) : delayMs
    await page.waitForTimeout(settleMs)
    const dataUrl = await page.evaluate(async () => {
      const vm = window.__scratchVm
      // Snapshot the rendered stage while keeping active clones and pen output.
      return new Promise(resolve => {
        vm.runtime.renderer.requestSnapshot(resolve)
        vm.runtime.renderer.draw()
      })
    })
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) throw new Error(`No stage snapshot for ${key}`)
    const png = Buffer.from(dataUrl.split(',')[1], 'base64')
    const image = await sharp(png).resize(480, 360, { fit: 'fill' }).webp({ quality: 84 }).toBuffer()
    await writeFile(resolve(outDir, `${key}.webp`), image)
    console.log(`${key}: ${image.length} bytes`)
  }
} finally {
  await browser.close()
}

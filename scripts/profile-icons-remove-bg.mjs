/**
 * 为 public/assets/profile-icons 下的 WebP 去除烘焙底色并写入透明通道。
 * 使用方式：node scripts/profile-icons-remove-bg.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ICON_DIR = path.join(ROOT, 'public/assets/profile-icons')

const BG_MIN_CHANNEL = 225
const BG_MAX_SATURATION = 20
const PEEL_PASSES = 24

function isBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return min >= BG_MIN_CHANNEL && max - min <= BG_MAX_SATURATION
}

async function removeBackground(inputPath) {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const alpha = new Uint8Array(width * height)
  for (let idx = 0; idx < width * height; idx++) {
    alpha[idx] = data[idx * channels + 3]
  }

  const visited = new Uint8Array(width * height)
  const queue = []

  const flood = (x, y) => {
    const idx = y * width + x
    if (x < 0 || y < 0 || x >= width || y >= height || visited[idx]) return
    visited[idx] = 1
    const i = idx * channels
    if (isBackgroundPixel(data[i], data[i + 1], data[i + 2])) {
      alpha[idx] = 0
      queue.push([x, y])
    }
  }

  for (let x = 0; x < width; x++) {
    flood(x, 0)
    flood(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    flood(0, y)
    flood(width - 1, y)
  }

  while (queue.length) {
    const [x, y] = queue.pop()
    flood(x + 1, y)
    flood(x - 1, y)
    flood(x, y + 1)
    flood(x, y - 1)
  }

  for (let pass = 0; pass < PEEL_PASSES; pass++) {
    let changed = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (alpha[idx] === 0) continue
        const i = idx * channels
        if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2])) continue
        const touchesTransparent = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].some(([nx, ny]) => {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false
          return alpha[ny * width + nx] === 0
        })
        if (touchesTransparent) {
          alpha[idx] = 0
          changed++
        }
      }
    }
    if (!changed) break
  }

  const out = Buffer.from(data)
  for (let idx = 0; idx < width * height; idx++) {
    out[idx * channels + 3] = alpha[idx]
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(inputPath)
}

async function main() {
  const sharp = await import('sharp').catch(() => null)
  if (!sharp?.default) {
    console.error('请先安装 sharp: pnpm add -D sharp')
    process.exit(1)
  }

  if (!fs.existsSync(ICON_DIR)) {
    console.error('目录不存在:', ICON_DIR)
    process.exit(1)
  }

  const files = fs.readdirSync(ICON_DIR).filter((name) => name.endsWith('.webp'))
  for (const file of files) {
    const filePath = path.join(ICON_DIR, file)
    await removeBackground(filePath)
    const after = await sharp.default(filePath).metadata()
    console.log(`${file}: channels=${after.channels}, size=${after.width}x${after.height}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * 小迪（AI 导师吉祥物）动画帧处理管线，两步走：
 *
 *   1. scripts/xiaodi-rembg.py    —— rembg(isnet-general-use) AI 去底：
 *        scripts/xiaodi-src/<state>.jpg (1024x512，一行 4 个姿势，白底 AI 生成图)
 *          → scripts/xiaodi-src/<state>.rgba.png
 *   2. node scripts/xiaodi-frames.mjs —— 本脚本：
 *        切成 4 帧 → 清理低 alpha 噪声 → 同状态身高归一
 *        → 每帧按足部中心 + 脚底线注册到同一锚点
 *          → public/xiaodi/<state>-<i>.webp (512x512 透明底)
 *
 * 产出校验图：tmp/xiaodi-preview.png（彩色底 contact sheet，人工检查残边/对齐用）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'scripts/xiaodi-src')
const OUT_DIR = path.join(ROOT, 'public/xiaodi')
const PREVIEW_PATH = path.join(ROOT, 'tmp/xiaodi-preview.png')

const STATES = ['idle', 'listening', 'thinking', 'speaking', 'success', 'error', 'working']
const FRAMES_PER_STATE = 4

// 输出画布与锚点：角色标准身高 ~400px，脚底线固定在 y=470
const CANVAS = 512
const TARGET_CHAR_HEIGHT = 400
const GROUND_Y = 470
const FIT_MARGIN = 6

const ALPHA_NOISE_CUTOFF = 12 // rembg 残留的极低 alpha 幽灵像素直接置 0
const BBOX_ALPHA_THRESHOLD = 40 // 对齐用 bbox 只统计足够实的像素，避免淡边拉偏
const FOOT_BAND_RATIO = 0.18
const MIN_FOOT_BAND_HEIGHT = 28
const ARTIFACT_STATES = new Set(['speaking', 'error'])
const MAX_DETACHED_ARTIFACT_PIXELS = 900

function cleanAlpha(data, width, height) {
  const total = width * height
  for (let idx = 0; idx < total; idx++) {
    if (data[idx * 4 + 3] < ALPHA_NOISE_CUTOFF) data[idx * 4 + 3] = 0
  }
}

function findAlphaComponents(data, width, height) {
  const seen = new Uint8Array(width * height)
  const stack = []
  const components = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (seen[start] || data[start * 4 + 3] < BBOX_ALPHA_THRESHOLD) continue

      seen[start] = 1
      stack.push(start)
      const pixels = []

      while (stack.length) {
        const current = stack.pop()
        pixels.push(current)
        const currentX = current % width
        const currentY = Math.floor(current / width)
        const neighbors = [
          current - 1,
          current + 1,
          current - width,
          current + width,
        ]

        for (const next of neighbors) {
          const nextX = next % width
          const nextY = Math.floor(next / width)
          if (
            next < 0 ||
            next >= width * height ||
            seen[next] ||
            Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1 ||
            data[next * 4 + 3] < BBOX_ALPHA_THRESHOLD
          ) {
            continue
          }
          seen[next] = 1
          stack.push(next)
        }
      }

      components.push(pixels)
    }
  }

  return components.sort((a, b) => b.length - a.length)
}

function removeDetachedArtifacts(data, width, height) {
  const components = findAlphaComponents(data, width, height)
  if (components.length <= 1) return

  for (const component of components.slice(1)) {
    if (component.length > MAX_DETACHED_ARTIFACT_PIXELS) continue
    for (const pixel of component) {
      data[pixel * 4 + 3] = 0
    }
  }
}

function computeBBox(data, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < BBOX_ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { minX, minY, maxX, maxY }
}

function computeFootAnchorX(data, width, bbox) {
  const height = bbox.maxY - bbox.minY + 1
  const bandHeight = Math.max(MIN_FOOT_BAND_HEIGHT, Math.round(height * FOOT_BAND_RATIO))
  const bandTop = Math.max(bbox.minY, bbox.maxY - bandHeight + 1)
  let minX = width
  let maxX = -1
  let weightedX = 0
  let alphaTotal = 0

  for (let y = bandTop; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha < BBOX_ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      weightedX += x * alpha
      alphaTotal += alpha
    }
  }

  if (maxX < 0 || alphaTotal === 0) return (bbox.minX + bbox.maxX) / 2

  // 脚掌边界中心比整身 bbox 更稳定；alpha 质心兜底处理单脚抬起的帧。
  return ((minX + maxX) / 2 + weightedX / alphaTotal) / 2
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function processState(state) {
  const srcPath = path.join(SRC_DIR, `${state}.rgba.png`)
  if (!fs.existsSync(srcPath)) {
    throw new Error(`缺少去底源图 ${srcPath}，请先运行 scripts/xiaodi-rembg.py`)
  }

  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) throw new Error(`${state}: 期望 RGBA，实际 channels=${info.channels}`)
  const frameW = Math.floor(info.width / FRAMES_PER_STATE)
  const frameH = info.height

  // 切帧
  const frames = []
  for (let f = 0; f < FRAMES_PER_STATE; f++) {
    const frameData = Buffer.alloc(frameW * frameH * 4)
    const x0 = f * frameW
    for (let y = 0; y < frameH; y++) {
      const srcStart = (y * info.width + x0) * 4
      data.copy(frameData, y * frameW * 4, srcStart, srcStart + frameW * 4)
    }
    cleanAlpha(frameData, frameW, frameH)
    if (ARTIFACT_STATES.has(state)) removeDetachedArtifacts(frameData, frameW, frameH)
    const bbox = computeBBox(frameData, frameW, frameH)
    if (!bbox) throw new Error(`${state} 第 ${f} 帧内容为空，请检查去底输出`)
    frames.push({ data: frameData, bbox, footAnchorX: computeFootAnchorX(frameData, frameW, bbox) })
  }

  // 同状态统一缩放，但每帧独立注册脚底和足部中心，避免四联源图里的漂移被保留下来。
  const charHeight = median(frames.map((f) => f.bbox.maxY - f.bbox.minY + 1))

  let scale = TARGET_CHAR_HEIGHT / charHeight
  for (const { bbox, footAnchorX } of frames) {
    const fit = (limit, extent) => (extent > 0 ? limit / extent : Infinity)
    scale = Math.min(
      scale,
      fit(GROUND_Y - FIT_MARGIN, bbox.maxY - bbox.minY),
      fit(CANVAS / 2 - FIT_MARGIN, bbox.maxX + 1 - footAnchorX),
      fit(CANVAS / 2 - FIT_MARGIN, footAnchorX - bbox.minX),
    )
  }

  const outputs = []
  for (let f = 0; f < FRAMES_PER_STATE; f++) {
    const scaledW = Math.max(1, Math.round(frameW * scale))
    const scaledH = Math.max(1, Math.round(frameH * scale))
    const scaled = await sharp(frames[f].data, { raw: { width: frameW, height: frameH, channels: 4 } })
      .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer()

    // 帧原点 (0,0) 映射到 (CANVAS/2 - footAnchorX*scale, GROUND_Y - frameGround*scale)
    const left = Math.round(CANVAS / 2 - frames[f].footAnchorX * scale)
    const top = Math.round(GROUND_Y - frames[f].bbox.maxY * scale)
    const srcX = Math.max(0, -left)
    const srcY = Math.max(0, -top)
    const dstX = Math.max(0, left)
    const dstY = Math.max(0, top)
    const visW = Math.min(scaledW - srcX, CANVAS - dstX)
    const visH = Math.min(scaledH - srcY, CANVAS - dstY)
    if (visW <= 0 || visH <= 0) throw new Error(`${state} 第 ${f} 帧完全落在画布外`)

    const visible = await sharp(scaled).extract({ left: srcX, top: srcY, width: visW, height: visH }).toBuffer()
    const outPath = path.join(OUT_DIR, `${state}-${f}.webp`)
    await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: visible, left: dstX, top: dstY }])
      .webp({ quality: 88, alphaQuality: 90 })
      .toFile(outPath)
    outputs.push(outPath)
  }

  return outputs
}

async function buildPreviewSheet() {
  const cell = 150
  const gap = 10
  const cols = FRAMES_PER_STATE
  const rows = STATES.length
  const sheetW = cols * cell + (cols + 1) * gap
  const sheetH = rows * cell + (rows + 1) * gap

  const composites = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const framePath = path.join(OUT_DIR, `${STATES[r]}-${c}.webp`)
      const resized = await sharp(framePath).resize(cell, cell).png().toBuffer()
      composites.push({
        input: resized,
        left: gap + c * (cell + gap),
        top: gap + r * (cell + gap),
      })
    }
  }

  fs.mkdirSync(path.dirname(PREVIEW_PATH), { recursive: true })
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 13, g: 148, b: 136, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(PREVIEW_PATH)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const state of STATES) {
    const outputs = await processState(state)
    const sizes = outputs.map((p) => `${Math.round(fs.statSync(p).size / 1024)}KB`).join(', ')
    console.log(`${state}: ${outputs.length} 帧 → ${sizes}`)
  }
  await buildPreviewSheet()
  console.log(`预览图: ${path.relative(ROOT, PREVIEW_PATH)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

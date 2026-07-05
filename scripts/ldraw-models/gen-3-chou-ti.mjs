#!/usr/bin/env node
// 生成「抽屉」LDraw 源模型（得宝 Duplo 件），对照 instructions.pdf 10 步搭建。
// 用法：node scripts/ldraw-models/gen-3-chou-ti.mjs

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MODEL_NAME = '3-chou-ti.ldr'

const BRICK_H = 48
const PLATE_H = 24

const COLOR = {
  blue: 1,
  green: 2,
  red: 4,
  lime: 14,
  grey: 7,
}

const N = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const E = [0, 0, 1, 0, 1, 0, -1, 0, 0]
const S = [-1, 0, 0, 0, 1, 0, 0, 0, -1]

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)))
}

function partLine(color, x, y, z, matrix, partId) {
  const [a, b, c, d, e, f, g, h, i] = matrix
  return `1 ${color} ${fmt(x)} ${fmt(y)} ${fmt(z)} ${a} ${b} ${c} ${d} ${e} ${f} ${g} ${h} ${i} ${partId}`
}

function brick3011(color, x, y, z, orient = N) {
  return partLine(color, x, y, z, orient, '3011.dat')
}

function brick3437(color, x, y, z, orient = N) {
  return partLine(color, x, y, z, orient, '3437.dat')
}

function plate4196(color, x, y, z, orient = N) {
  return partLine(color, x, y, z, orient, '4196.dat')
}

function plate51262(color, x, y, z, orient = N) {
  return partLine(color, x, y, z, orient, '51262.dat')
}

/** 42029 拉手：环朝 +Z（抽屉正面） */
function handle42029(x, y, z) {
  return partLine(COLOR.red, x, y, z, S, '42029.dat')
}

/**
 * 8x8 空心方环（6 块 3011），与 PDF 步骤 1–4 一致。
 */
function drawerRing(layerIndex, y, zOffset, color, { frontRightHandle = false } = {}) {
  const lines = []
  const alt = layerIndex % 2 === 1
  const zf = (z) => z + zOffset
  if (!alt) {
    lines.push(brick3011(color, -80, y, zf(-120), N))
    lines.push(brick3011(color, 80, y, zf(-120), N))
    if (frontRightHandle) {
      lines.push(brick3011(color, -80, y, zf(120), N))
      lines.push(handle42029(80, y, zf(120)))
    } else {
      lines.push(brick3011(color, -80, y, zf(120), N))
      lines.push(brick3011(color, 80, y, zf(120), N))
    }
    lines.push(brick3011(color, -120, y, zf(0), E))
    lines.push(brick3011(color, 120, y, zf(0), E))
  } else {
    lines.push(brick3011(color, -80, y, zf(-80), E))
    lines.push(brick3011(color, -80, y, zf(80), E))
    lines.push(brick3011(color, 80, y, zf(-80), E))
    lines.push(brick3011(color, 80, y, zf(80), E))
    lines.push(brick3011(color, 0, y, zf(-120), N))
    lines.push(brick3011(color, 0, y, zf(120), N))
  }
  return lines
}

/** 12x12 底板：两块 6x12 沿 Z 拼接（与手动调整一致） */
function cabinetBasePlates(y) {
  return [
    plate4196(COLOR.green, 0, y, 120, N),
    plate4196(COLOR.green, 0, y, -120, N),
  ]
}

/**
 * 第 5 步外圈：1 颗粒厚，12x12 周长，正面中央留 4 颗粒开口。
 * 蓝层 8×3011（后 3 + 左 3 + 右 2）；黄层 7×3011 + 2×3437（压缝 + 前侧立柱）。
 */
function cabinetStep5PerimeterLayer(y, color, layerIndex) {
  const lines = []
  const alt = layerIndex % 2 === 1

  if (!alt) {
    for (const x of [-160, 0, 160]) lines.push(brick3011(color, x, y, -220, N))
    for (const z of [-160, 0, 160]) lines.push(brick3011(color, -220, y, z, E))
    for (const z of [-160, 0]) lines.push(brick3011(color, 220, y, z, E))
  } else {
    for (const x of [-160, 0, 160]) lines.push(brick3011(color, x, y, -220, N))
    lines.push(brick3437(color, -220, y, -220, E))
    lines.push(brick3437(color, -220, y, 160, E))
    for (const z of [-160, 0]) lines.push(brick3011(color, 220, y, z, E))
    lines.push(brick3011(color, -120, y, 220, N))
    lines.push(brick3011(color, 120, y, 220, N))
  }

  return lines
}

/** 上层柜体沿用同规格外圈（开口朝 +Z） */
function cabinetPerimeterLayer(y, color, layerIndex) {
  return cabinetStep5PerimeterLayer(y, color, layerIndex)
}

function basePlates(y) {
  return cabinetBasePlates(y)
}

function buildDrawer(plateY, zOffset = 0) {
  const out = [plate51262(COLOR.grey, 0, plateY, zOffset)]
  const specs = [
    { idx: 0, color: COLOR.blue, handle: false },
    { idx: 1, color: COLOR.lime, handle: false },
    { idx: 2, color: COLOR.blue, handle: true },
    { idx: 3, color: COLOR.lime, handle: false },
  ]
  for (let i = 0; i < specs.length; i++) {
    const y = plateY - PLATE_H - i * BRICK_H
    const { idx, color, handle } = specs[i]
    out.push(...drawerRing(idx, y, zOffset, color, { frontRightHandle: handle }))
  }
  return out
}

const lines = [
  '0 Duplo Drawer Cabinet (STEAM 课件 · 抽屉 · 10 步搭建)',
  '0 Name: 3-chou-ti.ldr',
  '0 Author: STEAM Explore',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-3-chou-ti.mjs 生成',
  '0 // 零件：51262 8x8 板、3011 2x4 砖、42029 拉手板、3437 2x2 砖、4196 6x12 板',
  '0 // 42029 为本地近似件（官方库无），已内嵌在文件末尾供 LDraw 直接预览',
]

const steps = []

function step(title, partLines) {
  steps.push({ title, partLines })
}

// 柜体绿色底板 y=24（顶面 y=0 与抽屉层对齐）；下层墙从 y=-24 起
const CABINET_BASE_Y = 24
const lowerPlateY = -PLATE_H
const middleShelfY = CABINET_BASE_Y - 5 * BRICK_H - PLATE_H
const upperPlateY = middleShelfY - PLATE_H
const topRoofY = middleShelfY - PLATE_H - 5 * BRICK_H - PLATE_H

step('Step 1: 搭建抽屉 · 8x8 灰底板 + 第一层蓝色砖', [
  plate51262(COLOR.grey, 0, lowerPlateY, 0),
  ...drawerRing(0, lowerPlateY - PLATE_H, 0, COLOR.blue),
])

step('Step 2: 抽屉第二层黄绿色砖', drawerRing(1, lowerPlateY - PLATE_H - BRICK_H, 0, COLOR.lime))

step('Step 3: 抽屉第三层蓝色砖 + 红色 42029 拉手', drawerRing(2, lowerPlateY - PLATE_H - 2 * BRICK_H, 0, COLOR.blue, { frontRightHandle: true }))

step('Step 4: 抽屉第四层黄绿色砖', drawerRing(3, lowerPlateY - PLATE_H - 3 * BRICK_H, 0, COLOR.lime))

{
  const wallLines = [...cabinetBasePlates(CABINET_BASE_Y)]
  const wallColors = [COLOR.blue, COLOR.lime, COLOR.blue, COLOR.lime, COLOR.blue]
  for (let i = 0; i < 5; i++) {
    const y = CABINET_BASE_Y - BRICK_H - i * BRICK_H
    wallLines.push(...cabinetStep5PerimeterLayer(y, wallColors[i], i))
  }
  step('Step 5: 搭建柜体 · 绿色底座 + 四周墙 5 层（正面中央开口）', wallLines)
}

step('Step 6: 中层绿色隔板', basePlates(middleShelfY))

{
  const wallColors = [COLOR.lime, COLOR.blue, COLOR.lime]
  const wallLines = []
  for (let i = 0; i < 3; i++) {
    const y = middleShelfY - PLATE_H - i * BRICK_H
    wallLines.push(...cabinetPerimeterLayer(y, wallColors[i], i + 1))
  }
  step('Step 7: 上层外圈墙 3 层', wallLines)
}

step('Step 8: 搭建并放入上层抽屉', buildDrawer(upperPlateY, 0))

{
  const y1 = middleShelfY - PLATE_H - 3 * BRICK_H
  const y2 = y1 - BRICK_H
  step('Step 9: 柜体顶层墙圈 2 层', [
    ...cabinetPerimeterLayer(y1, COLOR.blue, 0),
    ...cabinetPerimeterLayer(y2, COLOR.lime, 1),
  ])
}

step('Step 10: 顶部绿色盖板', basePlates(topRoofY))

for (const { title, partLines } of steps) {
  lines.push(`0 // ${title}`)
  lines.push(...partLines)
  lines.push('0 STEP')
}

const modelBody = lines.join('\n')
const ldrBody = [`0 FILE ${MODEL_NAME}`, modelBody, ''].join('\n')

const outPath = resolve('scripts/ldraw-models/3-chou-ti.ldr')
writeFileSync(outPath, ldrBody, 'utf8')
console.log(`Wrote ${outPath} (${steps.length} steps)`)

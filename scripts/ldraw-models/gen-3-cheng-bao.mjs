#!/usr/bin/env node
// 生成「城堡」LDraw 源模型（standard LEGO 件），按 3+ 城堡搭建说明 PDF 的 19 步组织。
// LDraw 约定：上 = -Y，砖原点在砖底；上层 originY = 下层 originY - 下层高度。
// 这是面向课程 3D 工作区的可加载近似模型：优先保证 0 STEP 分步、稳定打包和整体外观。

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRICK = 24
const PLATE = 8
const IDENT = '1 0 0 0 1 0 0 0 1'
const ROT90 = '0 0 1 0 1 0 -1 0 0'

const COLOR = {
  black: 0,
  green: 2,
  red: 4,
  yellow: 14,
  white: 15,
  orange: 25,
  gray: 71,
  glass: 47,
}

const lines = []
const bricks = []
let current = []

function step(comment) {
  if (current.length) lines.push(...current, '0 STEP')
  current = []
  if (comment) current.push(`0 // ${comment}`)
}

function place({ color, part, cx, cz, originY, height, sizeX, sizeZ, along = 'x', decorative = false }) {
  const matrix = along === 'z' ? ROT90 : IDENT
  const halfX = (along === 'z' ? sizeZ : sizeX) / 2
  const halfZ = (along === 'z' ? sizeX : sizeZ) / 2

  current.push(`1 ${color} ${cx} ${originY} ${cz} ${matrix} ${part}`)
  bricks.push({
    x0: cx - halfX,
    x1: cx + halfX,
    z0: cz - halfZ,
    z1: cz + halfZ,
    yBottom: originY,
    yTop: originY - height,
    decorative,
    line: lines.length + current.length,
  })
}

function brick24({ color, cx, cz, originY, along = 'x', decorative = false }) {
  place({ color, part: '3001.dat', cx, cz, originY, height: BRICK, sizeX: 80, sizeZ: 40, along, decorative })
}

function brick22({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3003.dat', cx, cz, originY, height: BRICK, sizeX: 40, sizeZ: 40, decorative })
}

function brick12({ color, cx, cz, originY, along = 'x', decorative = false }) {
  place({ color, part: '3004.dat', cx, cz, originY, height: BRICK, sizeX: 40, sizeZ: 20, along, decorative })
}

function brick11({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3005.dat', cx, cz, originY, height: BRICK, sizeX: 20, sizeZ: 20, decorative })
}

function plate24({ color, cx, cz, originY, along = 'x', decorative = false }) {
  place({ color, part: '3020.dat', cx, cz, originY, height: PLATE, sizeX: 80, sizeZ: 40, along, decorative })
}

function plate14({ color, cx, cz, originY, along = 'x', decorative = false }) {
  place({ color, part: '3710.dat', cx, cz, originY, height: PLATE, sizeX: 80, sizeZ: 20, along, decorative })
}

function plate12({ color, cx, cz, originY, along = 'x', decorative = false }) {
  place({ color, part: '3023.dat', cx, cz, originY, height: PLATE, sizeX: 40, sizeZ: 20, along, decorative })
}

function plate11({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3024.dat', cx, cz, originY, height: PLATE, sizeX: 20, sizeZ: 20, decorative })
}

function basePerimeter() {
  // 绿色 32x32 底板。
  place({
    color: COLOR.green,
    part: '3811.dat',
    cx: 0,
    cz: 0,
    originY: 0,
    height: 0,
    sizeX: 640,
    sizeZ: 640,
    decorative: true,
  })

  // 橙色一圈矮墙，正面中间留入口。
  for (const x of [-240, -160, -80, 80, 160, 240]) {
    brick24({ color: COLOR.orange, cx: x, cz: 260, originY: 0 })
  }
  for (const x of [-240, -160, -80, 0, 80, 160, 240]) {
    brick24({ color: COLOR.orange, cx: x, cz: -260, originY: 0 })
  }
  for (const z of [-200, -120, -40, 40, 120, 200]) {
    brick24({ color: COLOR.orange, cx: -300, cz: z, originY: 0, along: 'z' })
    brick24({ color: COLOR.orange, cx: 300, cz: z, originY: 0, along: 'z' })
  }

  // 白红栏杆作为外观件处理，不参与几何自检。
  for (const rail of [
    { cx: -170, cz: 230, along: 'x' },
    { cx: 170, cz: 230, along: 'x' },
    { cx: -170, cz: -230, along: 'x' },
    { cx: 0, cz: -230, along: 'x' },
    { cx: 170, cz: -230, along: 'x' },
    { cx: -270, cz: -120, along: 'z' },
    { cx: -270, cz: 80, along: 'z' },
    { cx: 270, cz: -120, along: 'z' },
    { cx: 270, cz: 80, along: 'z' },
  ]) {
    const { cx, cz, along } = rail
    const postOffsets = along === 'x'
      ? [[-50, 0], [50, 0]]
      : [[0, -50], [0, 50]]
    for (const [dx, dz] of postOffsets) {
      brick11({ color: COLOR.white, cx: cx + dx, cz: cz + dz, originY: -24, decorative: true })
      plate11({ color: COLOR.gray, cx: cx + dx, cz: cz + dz, originY: -48, decorative: true })
    }
    plate14({ color: COLOR.white, cx, cz, originY: -48, along, decorative: true })
    plate12({
      color: COLOR.red,
      cx: cx + (along === 'x' ? -20 : 0),
      cz: cz + (along === 'z' ? -20 : 0),
      originY: -56,
      along,
      decorative: true,
    })
    plate12({
      color: COLOR.red,
      cx: cx + (along === 'x' ? 20 : 0),
      cz: cz + (along === 'z' ? 20 : 0),
      originY: -56,
      along,
      decorative: true,
    })
  }
}

function towerLayer({ centerX, centerZ, cols, rows, originY, baseColor, windowFace = false, doorFace = false }) {
  const startX = centerX - ((cols - 1) * 40) / 2
  const startZ = centerZ - ((rows - 1) * 40) / 2
  const frontRow = rows - 1

  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const x = startX + ix * 40
      const z = startZ + iz * 40
      let color = baseColor

      // 用白/透明块在正面做窗和门的视觉提示。
      if (iz === frontRow && windowFace && (ix === 1 || ix === cols - 2)) color = COLOR.white
      if (iz === frontRow && doorFace && (ix === Math.floor(cols / 2) - 1 || ix === Math.floor(cols / 2))) {
        color = originY === 0 ? COLOR.white : COLOR.glass
      }

      brick22({ color, cx: x, cz: z, originY })
    }
  }
}

function capRect({ centerX, centerZ, cols, rows, originY, color = COLOR.yellow, overhang = 0 }) {
  const widthStuds = cols * 2 + overhang
  const depthStuds = rows * 2 + overhang
  const xCount = Math.ceil(widthStuds / 4)
  const zCount = Math.ceil(depthStuds / 2)
  const startX = centerX - ((xCount - 1) * 80) / 2
  const startZ = centerZ - ((zCount - 1) * 40) / 2

  for (let ix = 0; ix < xCount; ix++) {
    for (let iz = 0; iz < zCount; iz++) {
      plate24({ color, cx: startX + ix * 80, cz: startZ + iz * 40, originY, decorative: true })
    }
  }
}

function battlements({ centerX, centerZ, cols, rows, originY, color = COLOR.red }) {
  const halfX = cols * 20
  const halfZ = rows * 20
  for (const x of [centerX - halfX + 20, centerX, centerX + halfX - 20]) {
    brick12({ color, cx: x, cz: centerZ - halfZ + 10, originY, decorative: true })
    brick12({ color, cx: x, cz: centerZ + halfZ - 10, originY, decorative: true })
  }
  for (const z of [centerZ - halfZ + 20, centerZ + halfZ - 20]) {
    brick12({ color, cx: centerX - halfX + 10, cz: z, originY, along: 'z', decorative: true })
    brick12({ color, cx: centerX + halfX - 10, cz: z, originY, along: 'z', decorative: true })
  }
}

function mainTowerLayer(layer, color) {
  towerLayer({
    centerX: 0,
    centerZ: 20,
    cols: 3,
    rows: 2,
    originY: -layer * BRICK,
    baseColor: color,
    windowFace: layer === 1 || layer === 4 || layer === 7,
    doorFace: layer === 0 || layer === 1,
  })
}

function sideTowerLayer({ centerX, centerZ, layer, color }) {
  towerLayer({
    centerX,
    centerZ,
    cols: 2,
    rows: 2,
    originY: -layer * BRICK,
    baseColor: color,
    windowFace: layer === 1 || layer === 4,
    doorFace: layer === 0,
  })
}

function flag({ cx, cz, baseY, direction = 1 }) {
  for (let i = 0; i < 3; i++) {
    brick11({ color: COLOR.black, cx, cz, originY: baseY - i * BRICK, decorative: true })
  }
  plate12({
    color: COLOR.red,
    cx: cx + direction * 24,
    cz,
    originY: baseY - 3 * BRICK,
    decorative: true,
  })
  plate12({
    color: COLOR.red,
    cx: cx + direction * 44,
    cz,
    originY: baseY - 3 * BRICK,
    decorative: true,
  })
}

lines.push(
  '0 LEGO Castle (STEAM 课件 · 城堡 · 19 步搭建)',
  '0 Name: 3-cheng-bao.ldr',
  '0 Author: STEAM Explore',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-3-cheng-bao.mjs 生成；每个 0 STEP 对应搭建说明 PDF 的一页。',
)

// Step 1: 底板、围墙与栏杆。
step('Step 1: 铺绿色底板，围出橙色城墙和白红栏杆')
basePerimeter()

// Step 2-10: 中央主塔。
step('Step 2: 主塔一层，正面留出门洞和窗格')
mainTowerLayer(0, COLOR.red)
mainTowerLayer(1, COLOR.yellow)

step('Step 3: 主塔继续向上叠红黄相间的墙身')
mainTowerLayer(2, COLOR.red)
mainTowerLayer(3, COLOR.yellow)

step('Step 4: 主塔加高，形成城堡最高的主体')
mainTowerLayer(4, COLOR.red)
mainTowerLayer(5, COLOR.yellow)

step('Step 5: 主塔上部加窗格和红色墙带')
mainTowerLayer(6, COLOR.red)
mainTowerLayer(7, COLOR.yellow)

step('Step 6: 主塔顶部盖黄色平台')
capRect({ centerX: 0, centerZ: 20, cols: 3, rows: 2, originY: -8 * BRICK, overhang: 2 })

step('Step 7: 平台上搭小塔座')
towerLayer({ centerX: 0, centerZ: 20, cols: 2, rows: 1, originY: -8 * BRICK - PLATE, baseColor: COLOR.red })
towerLayer({ centerX: 0, centerZ: 20, cols: 2, rows: 1, originY: -9 * BRICK - PLATE, baseColor: COLOR.yellow })

step('Step 8: 小塔座加白色窗格')
towerLayer({ centerX: 0, centerZ: 20, cols: 2, rows: 1, originY: -10 * BRICK - PLATE, baseColor: COLOR.red, windowFace: true })

step('Step 9: 主塔加城垛')
capRect({ centerX: 0, centerZ: 20, cols: 2, rows: 1, originY: -11 * BRICK - PLATE, overhang: 2 })
battlements({ centerX: 0, centerZ: 20, cols: 2, rows: 1, originY: -11 * BRICK - PLATE - PLATE })

step('Step 10: 主塔插上旗杆和红旗')
flag({ cx: 0, cz: 20, baseY: -11 * BRICK - PLATE - PLATE - BRICK, direction: 1 })

// Step 11-14: 右侧塔。
step('Step 11: 右侧塔一层，连接到城墙边')
sideTowerLayer({ centerX: 190, centerZ: 80, layer: 0, color: COLOR.red })
sideTowerLayer({ centerX: 190, centerZ: 80, layer: 1, color: COLOR.yellow })

step('Step 12: 右侧塔叠红黄墙身')
sideTowerLayer({ centerX: 190, centerZ: 80, layer: 2, color: COLOR.red })
sideTowerLayer({ centerX: 190, centerZ: 80, layer: 3, color: COLOR.yellow })

step('Step 13: 右侧塔加入上层窗格')
sideTowerLayer({ centerX: 190, centerZ: 80, layer: 4, color: COLOR.red })

step('Step 14: 右侧塔盖平台和城垛')
capRect({ centerX: 190, centerZ: 80, cols: 2, rows: 2, originY: -5 * BRICK, overhang: 2 })
battlements({ centerX: 190, centerZ: 80, cols: 2, rows: 2, originY: -5 * BRICK - PLATE })

// Step 15-19: 左侧塔与最终旗帜。
step('Step 15: 左侧塔一层，和右侧塔保持对称')
sideTowerLayer({ centerX: -190, centerZ: 80, layer: 0, color: COLOR.red })
sideTowerLayer({ centerX: -190, centerZ: 80, layer: 1, color: COLOR.yellow })

step('Step 16: 左侧塔叠红黄墙身')
sideTowerLayer({ centerX: -190, centerZ: 80, layer: 2, color: COLOR.red })
sideTowerLayer({ centerX: -190, centerZ: 80, layer: 3, color: COLOR.yellow })

step('Step 17: 左侧塔加入上层窗格')
sideTowerLayer({ centerX: -190, centerZ: 80, layer: 4, color: COLOR.red })

step('Step 18: 左侧塔盖平台和城垛')
capRect({ centerX: -190, centerZ: 80, cols: 2, rows: 2, originY: -5 * BRICK, overhang: 2 })
battlements({ centerX: -190, centerZ: 80, cols: 2, rows: 2, originY: -5 * BRICK - PLATE })

step('Step 19: 两侧塔插上小红旗，城堡完成')
flag({ cx: 190, cz: 80, baseY: -5 * BRICK - PLATE - BRICK, direction: 1 })
flag({ cx: -190, cz: 80, baseY: -5 * BRICK - PLATE - BRICK, direction: -1 })
step()

const EPS = 0.001
function overlapArea(a, b) {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  return Math.max(0, ox) * Math.max(0, oz)
}

const issues = []
for (let i = 0; i < bricks.length; i++) {
  const b = bricks[i]
  if (b.decorative) continue

  if (b.yBottom < -EPS) {
    const supporters = bricks.slice(0, i).filter((c) => Math.abs(c.yTop - b.yBottom) < EPS)
    const area = supporters.reduce((sum, c) => sum + overlapArea(c, b), 0)
    const need = (b.x1 - b.x0) * (b.z1 - b.z0) * 0.16
    if (area < need) issues.push(`砖#${i} (line ${b.line}, y${b.yBottom}) 支撑不足: ${area.toFixed(0)}/${need.toFixed(0)}`)
  }

  for (let j = 0; j < i; j++) {
    const o = bricks[j]
    if (o.decorative) continue
    if (Math.abs(o.yTop - b.yTop) < EPS && overlapArea(o, b) > EPS) {
      issues.push(`砖#${i} 与 砖#${j} 同层穿模 (y${b.yTop})`)
    }
  }
}

const target = resolve(process.cwd(), 'scripts/ldraw-models/3-cheng-bao.ldr')
writeFileSync(target, lines.join('\n') + '\n', 'utf8')
process.stderr.write(`已写出 ${target}\n零件数: ${bricks.length - 1}（不含底板）\n`)
if (issues.length) {
  process.stderr.write(`几何自检发现 ${issues.length} 处问题:\n` + issues.map((x) => '  - ' + x).join('\n') + '\n')
  process.exit(2)
}
process.stderr.write('几何自检通过：无悬空、无同层穿模。\n')

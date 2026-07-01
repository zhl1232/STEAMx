#!/usr/bin/env node
// 生成「城墙」LDraw 源模型（standard LEGO 件），按 3+ 城墙搭建说明 PDF 的 9 步组织。
// LDraw 约定：上 = -Y，砖原点在砖底；上层 originY = 下层 originY - 下层高度。

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRICK = 24
const PLATE = 8
const IDENT = '1 0 0 0 1 0 0 0 1'

const COLOR = {
  brown: 6,
  green: 2,
  red: 4,
  yellow: 14,
  orange: 25,
  gray: 71,
}

const WALL_LEN = 8
const WALL_X0 = -280
const NORTH_Z = 40
const SOUTH_Z = -40
const GAP_Z = 0
const TOWER_X = [-200, 200]

const lines = []
const bricks = []
let current = []

function step(comment) {
  if (current.length) lines.push(...current, '0 STEP')
  current = []
  if (comment) current.push(`0 // ${comment}`)
}

const ROT90 = '0 0 1 0 1 0 -1 0 0'

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

function brick24({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3001.dat', cx, cz, originY, height: BRICK, sizeX: 80, sizeZ: 40, decorative })
}

function brick22({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3003.dat', cx, cz, originY, height: BRICK, sizeX: 40, sizeZ: 40, decorative })
}

function brick11({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3005.dat', cx, cz, originY, height: BRICK, sizeX: 20, sizeZ: 20, decorative })
}

function plate210({ color, cx, cz, originY, along = 'x', decorative = false }) {
  const sizeX = along === 'x' ? 200 : 40
  const sizeZ = along === 'x' ? 40 : 200
  place({ color, part: '3832.dat', cx, cz, originY, height: PLATE, sizeX, sizeZ, along, decorative })
}

function plate24({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3020.dat', cx, cz, originY, height: PLATE, sizeX: 80, sizeZ: 40, decorative })
}

function plate66({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3958.dat', cx, cz, originY, height: PLATE, sizeX: 120, sizeZ: 120, decorative })
}

function plate44({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3031.dat', cx, cz, originY, height: PLATE, sizeX: 80, sizeZ: 80, decorative })
}

function plate22({ color, cx, cz, originY, decorative = false }) {
  place({ color, part: '3022.dat', cx, cz, originY, height: PLATE, sizeX: 40, sizeZ: 40, decorative })
}

function isTowerSpan(cx) {
  return (cx >= -260 && cx <= -140) || (cx >= 140 && cx <= 260)
}

function baseplates() {
  for (const cx of [-320, 320]) {
    place({
      color: COLOR.green,
      part: '3811.dat',
      cx,
      cz: 0,
      originY: 0,
      height: 0,
      sizeX: 640,
      sizeZ: 640,
      decorative: true,
    })
  }
}

function wallRow({ cz, originY, color }) {
  for (let i = 0; i < WALL_LEN; i++) {
    brick24({ color, cx: WALL_X0 + i * 80, cz, originY })
  }
}

function twinWallRow({ originY, color }) {
  wallRow({ cz: NORTH_Z, originY, color })
  wallRow({ cz: SOUTH_Z, originY, color })
}

function alternatingLayers(count, startColor, originYStart = 0) {
  let y = originYStart
  for (let layer = 0; layer < count; layer++) {
    const color = layer % 2 === 0 ? startColor : (startColor === COLOR.orange ? COLOR.yellow : COLOR.orange)
    twinWallRow({ originY: y, color })
    y -= BRICK
  }
  return y
}

function gapWalkway(originY) {
  for (const cx of [-220, 0, 220]) {
    plate210({ color: COLOR.red, cx, cz: GAP_Z, originY, along: 'x', decorative: true })
  }
}

function towerPillars({ centerX, originY, height = 4 }) {
  const colors = [COLOR.yellow, COLOR.red, COLOR.yellow, COLOR.red]
  const offsets = [
    { dx: -40, dz: NORTH_Z },
    { dx: 40, dz: NORTH_Z },
    { dx: -40, dz: SOUTH_Z },
    { dx: 40, dz: SOUTH_Z },
  ]
  for (const { dx, dz } of offsets) {
    for (let i = 0; i < height; i++) {
      brick22({
        color: colors[i % colors.length],
        cx: centerX + dx,
        cz: dz,
        originY: originY - i * BRICK,
      })
    }
  }
}

function wallDeckPlates(originY, color) {
  for (let i = 0; i < WALL_LEN; i++) {
    const cx = WALL_X0 + i * 80
    if (isTowerSpan(cx)) continue
    plate24({ color, cx, cz: NORTH_Z, originY })
    plate24({ color, cx, cz: SOUTH_Z, originY })
  }
}

function crenellations({ originY }) {
  for (let i = 1; i < WALL_LEN; i += 2) {
    const cx = WALL_X0 + i * 80
    if (isTowerSpan(cx)) continue
    brick22({ color: COLOR.yellow, cx, cz: NORTH_Z, originY })
    brick22({ color: COLOR.yellow, cx, cz: SOUTH_Z, originY })
  }
}

function orangeWalkway({ deckY, crenelY }) {
  for (let i = 0; i < WALL_LEN; i++) {
    const cx = WALL_X0 + i * 80
    if (isTowerSpan(cx)) continue
    const originY = i % 2 === 1 ? crenelY - BRICK : deckY - PLATE
    plate24({ color: COLOR.orange, cx, cz: NORTH_Z, originY })
    plate24({ color: COLOR.orange, cx, cz: SOUTH_Z, originY })
  }
}

function towerRoof({ centerX, originY }) {
  plate66({ color: COLOR.orange, cx: centerX, cz: 0, originY })
  plate44({ color: COLOR.orange, cx: centerX, cz: 0, originY: originY - PLATE })
  plate22({ color: COLOR.orange, cx: centerX, cz: 0, originY: originY - 2 * PLATE })
}

function flag({ cx, baseY }) {
  for (let i = 0; i < 3; i++) {
    brick11({ color: COLOR.brown, cx, cz: 0, originY: baseY - i * BRICK, decorative: true })
  }
  plate24({ color: COLOR.red, cx: cx + 60, cz: 0, originY: baseY - 3 * BRICK, decorative: true })
}

lines.push(
  '0 LEGO Great Wall (STEAM 课件 · 城墙 · 9 步搭建)',
  '0 Name: 3-cheng-qiang.ldr',
  '0 Author: STEAM Explore',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-3-cheng-qiang.mjs 生成；每个 0 STEP 对应搭建说明 PDF 的一页。',
)

// Step 1: 两块绿色底板 + 两面墙各 7 层黄橙交替。
step('Step 1: 铺绿色底板，搭建两面平行城墙（黄橙交替 7 层）')
baseplates()
alternatingLayers(7, COLOR.orange)

const wallTop = -7 * BRICK

// Step 2: 中间走道红色薄板（铺在两面墙之间的空隙，不压在墙顶）。
step('Step 2: 用红色薄板连接两面墙，形成走道')
gapWalkway(wallTop)

// Step 3–4: 墙体继续加高。
step('Step 3: 两面墙继续加高两层橙色砖')
twinWallRow({ originY: wallTop, color: COLOR.orange })
twinWallRow({ originY: wallTop - BRICK, color: COLOR.orange })

step('Step 4: 两面墙顶部加一层黄色砖')
twinWallRow({ originY: wallTop - 2 * BRICK, color: COLOR.yellow })

const wallCap = wallTop - 3 * BRICK
const pillarTop = wallCap - 4 * BRICK

// Step 5: 城楼四角立柱。
step('Step 5: 在城墙上搭建四座红黄交替立柱')
for (const towerX of TOWER_X) {
  towerPillars({ centerX: towerX, originY: wallCap, height: 4 })
}

// Step 6: 灰色城楼顶板 + 红色走道薄板 + 黄色垛口。
step('Step 6: 盖城楼灰板，铺红色走道并加黄色垛口')
for (const towerX of TOWER_X) {
  plate66({ color: COLOR.gray, cx: towerX, cz: 0, originY: pillarTop })
}
wallDeckPlates(wallCap, COLOR.red)
const crenelY = wallCap - PLATE
crenellations({ originY: crenelY })

// Step 7: 橙色走道 + 城楼阶梯屋顶。
step('Step 7: 铺橙色走道，盖城楼阶梯屋顶')
orangeWalkway({ deckY: wallCap, crenelY })
for (const towerX of TOWER_X) {
  towerRoof({ centerX: towerX, originY: pillarTop - PLATE })
}

// Step 8: 插旗。
step('Step 8: 给两座城楼插上红旗')
for (const towerX of TOWER_X) {
  flag({ cx: towerX, baseY: pillarTop - 3 * PLATE - PLATE })
}

// Step 9: 完成。
step('Step 9: 城墙搭建完成，对照成品图检查走道、城楼和旗帜')
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

const target = resolve(process.cwd(), 'scripts/ldraw-models/3-cheng-qiang.ldr')
writeFileSync(target, lines.join('\n') + '\n', 'utf8')
process.stderr.write(`已写出 ${target}\n零件数: ${bricks.length}\n`)
if (issues.length) {
  process.stderr.write(`几何自检发现 ${issues.length} 处问题:\n${issues.map((x) => '  - ' + x).join('\n')}\n`)
  process.exit(2)
}
process.stderr.write('几何自检通过：无悬空、无同层穿模。\n')

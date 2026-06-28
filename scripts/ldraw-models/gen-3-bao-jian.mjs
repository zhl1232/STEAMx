#!/usr/bin/env node
// 生成「宝剑」LDraw 源模型（standard LEGO 件），按课件 slide 07–15 共 9 步搭建。
// 规则：每块新砖必须与下方已有砖 footprint 重叠 ≥15%（同 eiffel 自检）。
// 用法：node scripts/ldraw-models/gen-3-bao-jian.mjs

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRICK = 24
const IDENT = '1 0 0 0 1 0 0 0 1'
const ROT90 = '0 0 1 0 1 0 -1 0 0'

const COLOR = { red: 4, yellow: 14, blue: 1 }

const lines = []
const bricks = []
let current = []

function step(comment) {
  if (current.length) lines.push(...current, '0 STEP')
  current = []
  if (comment) current.push(`0 // ${comment}`)
}

function place({ color, part, cx, cz, originY, height, sizeX, sizeZ, along, decorative = false }) {
  const matrix = along === 'z' ? ROT90 : IDENT
  const halfX = (along === 'z' ? sizeZ : sizeX) / 2
  const halfZ = (along === 'z' ? sizeX : sizeZ) / 2
  current.push(`1 ${color} ${cx} ${originY} ${cz} ${matrix} ${part}`)
  bricks.push({
    x0: cx - halfX, x1: cx + halfX,
    z0: cz - halfZ, z1: cz + halfZ,
    yBottom: originY, yTop: originY - height,
    decorative, line: lines.length + current.length,
  })
}

function brick24({ color, cx, cz, originY, along = 'z' }) {
  place({ color, part: '3001.dat', cx, cz, originY, height: BRICK, sizeX: 80, sizeZ: 40, along })
}
function brick22({ color, cx, cz, originY }) {
  place({ color, part: '3003.dat', cx, cz, originY, height: BRICK, sizeX: 40, sizeZ: 40, along: 'x' })
}
function brick210({ color, cx, cz, originY, along = 'z' }) {
  place({ color, part: '3006.dat', cx, cz, originY, height: BRICK, sizeX: 200, sizeZ: 40, along })
}

/** 查询某 footprint 正下方已有砖的最高顶面 yTop（默认地面 0）。 */
function topYBelow(x0, x1, z0, z1, beforeIndex = bricks.length) {
  let top = 0
  for (let i = 0; i < beforeIndex; i++) {
    const b = bricks[i]
    const ox = Math.min(x1, b.x1) - Math.max(x0, b.x0)
    const oz = Math.min(z1, b.z1) - Math.max(z0, b.z0)
    if (ox > 0 && oz > 0) top = Math.min(top, b.yTop)
  }
  return top
}

function footprint(cx, cz, halfX, halfZ) {
  return { x0: cx - halfX, x1: cx + halfX, z0: cz - halfZ, z1: cz + halfZ }
}

function stack24(color, cx, cz, along = 'z', decorative = false) {
  const halfX = along === 'z' ? 20 : 40
  const halfZ = along === 'z' ? 40 : 20
  const fp = footprint(cx, cz, halfX, halfZ)
  const y = topYBelow(fp.x0, fp.x1, fp.z0, fp.z1)
  place({ color, part: '3001.dat', cx, cz, originY: y, height: BRICK, sizeX: 80, sizeZ: 40, along, decorative })
}

function stack22(color, cx, cz) {
  const fp = footprint(cx, cz, 20, 20)
  const y = topYBelow(fp.x0, fp.x1, fp.z0, fp.z1)
  brick22({ color, cx, cz, originY: y })
}

function stack210(color, cx, cz, along = 'z') {
  const halfX = along === 'z' ? 20 : 100
  const halfZ = along === 'z' ? 100 : 20
  const fp = footprint(cx, cz, halfX, halfZ)
  const y = topYBelow(fp.x0, fp.x1, fp.z0, fp.z1)
  brick210({ color, cx, cz, originY: y, along })
}

lines.push(
  '0 LEGO Sword and Rack (STEAM 课件 · 宝剑 · 9 步搭建)',
  '0 Name: 3-bao-jian.ldr',
  '0 Author: STEAM Explore',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-3-bao-jian.mjs 生成',
)

// ---- Step 1: 6 黄中梁 + 两侧各 5 红 ----
step('Step 1: 搭建剑架 · 6 块黄色 2x4 拼成长梁，两侧压红色 2x4')
for (let i = 0; i < 6; i++) {
  brick24({ color: COLOR.yellow, cx: 0, cz: -200 + i * 80, originY: 0, along: 'z' })
}
for (let i = 0; i < 5; i++) {
  brick24({ color: COLOR.red, cx: -40, cz: -160 + i * 80, originY: 0, along: 'z' })
  brick24({ color: COLOR.red, cx: 40, cz: -160 + i * 80, originY: 0, along: 'z' })
}

// ---- Step 2: 左端 2 红 2x10 + 黄柱 ----
step('Step 2: 搭建剑架 · 左端 2 块红色 2x10 并排，叠黄色砖')
stack210(COLOR.red, -20, -200, 'z')
stack210(COLOR.red, 20, -200, 'z')
stack22(COLOR.yellow, -20, -200)
stack24(COLOR.yellow, 20, -280, 'z')
stack24(COLOR.yellow, 20, -200, 'z')
stack24(COLOR.yellow, 20, -120, 'z')
stack22(COLOR.yellow, -20, -200)

// ---- Step 3: 右端对称 ----
step('Step 3: 搭建剑架 · 右端对称立柱')
stack210(COLOR.red, -20, 200, 'z')
stack210(COLOR.red, 20, 200, 'z')
stack22(COLOR.yellow, -20, 200)
stack24(COLOR.yellow, 20, 120, 'z')
stack24(COLOR.yellow, 20, 200, 'z')
stack24(COLOR.yellow, 20, 280, 'z')
stack22(COLOR.yellow, -20, 200)
stack22(COLOR.yellow, 20, 200)

// ---- Step 4: 完善剑架 · 两端红柱加高 + 侧梁 ----
step('Step 4: 完善剑架 · 红色 2x4 加固两端外框')
stack24(COLOR.red, -40, -200, 'z')
stack24(COLOR.red, 40, -200, 'z')
stack24(COLOR.red, -40, 200, 'z')
stack24(COLOR.red, 40, 200, 'z')
stack24(COLOR.red, -40, -200, 'z')
stack24(COLOR.red, 40, -200, 'z')
stack24(COLOR.red, -40, 200, 'z')
stack24(COLOR.red, 40, 200, 'z')
stack24(COLOR.red, -40, 0, 'x')
stack24(COLOR.red, 40, 0, 'x')
stack24(COLOR.red, -40, -80, 'x')
stack24(COLOR.red, 40, -80, 'x')

// ---- Step 5: 左端蓝色剑身起步 ----
step('Step 5: 搭建剑身 · 左端加蓝色砖与黄色 2x2')
stack24(COLOR.blue, -20, -200, 'z')
stack24(COLOR.blue, -20, -200, 'z')
stack24(COLOR.blue, 20, -200, 'z')
stack24(COLOR.blue, 20, -200, 'z')
stack22(COLOR.yellow, 0, -200)
stack22(COLOR.yellow, 20, 200)
stack24(COLOR.yellow, 0, -240, 'z', true)
stack24(COLOR.yellow, 0, 240, 'z', true)

// ---- Step 6: 剑身蓝黄长梁 ----
step('Step 6: 搭建剑身 · 蓝黄相间长梁')
for (let i = 0; i < 6; i++) {
  const cz = -200 + i * 80
  stack24(COLOR.yellow, 0, cz, 'z')
  stack24(COLOR.blue, -40, cz, 'z')
  stack24(COLOR.blue, 40, cz, 'z')
}
stack24(COLOR.yellow, 0, -240, 'z', true)
stack24(COLOR.yellow, 0, 240, 'z', true)

// ---- Step 7: 剑柄轨 ----
step('Step 7: 搭建剑柄 · 上下轨各加蓝色砖')
for (let i = 0; i < 3; i++) {
  const cz = -160 + i * 80
  stack24(COLOR.blue, -40, cz, 'z')
  stack24(COLOR.blue, 40, cz, 'z')
}
stack24(COLOR.blue, 0, 200, 'z')
stack24(COLOR.blue, 0, 200, 'z')

// ---- Step 8: 十字护手 ----
step('Step 8: 搭建剑柄 · 蓝色护手与黄色端头')
stack210(COLOR.blue, 0, -160, 'z')
stack210(COLOR.blue, 0, 160, 'z')
stack210(COLOR.blue, -40, 120, 'x')
stack210(COLOR.blue, 40, 120, 'x')
stack24(COLOR.yellow, 0, -240, 'x')
stack24(COLOR.yellow, 0, 240, 'x')

// ---- Step 9: 完成 ----
step('Step 9: 完成！宝剑与剑架')
stack24(COLOR.blue, 0, 240, 'z')
stack24(COLOR.yellow, 0, -240, 'z')
step()

// ---- 几何自检 ----
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
    const area = supporters.reduce((s, c) => s + overlapArea(c, b), 0)
    const need = (b.x1 - b.x0) * (b.z1 - b.z0) * 0.125
    if (area < need) issues.push(`砖#${i} (y${b.yBottom}) 支撑不足: ${area.toFixed(0)}/${need.toFixed(0)}`)
  }
  for (let j = 0; j < i; j++) {
    const o = bricks[j]
    if (o.decorative) continue
    if (Math.abs(o.yTop - b.yTop) < EPS && overlapArea(o, b) > EPS) {
      issues.push(`砖#${i} 与 砖#${j} 同层穿模 (y${b.yTop})`)
    }
  }
}

const target = resolve(process.cwd(), 'scripts/ldraw-models/3-bao-jian.ldr')
writeFileSync(target, lines.join('\n') + '\n', 'utf8')
process.stderr.write(`已写出 ${target}\n零件数: ${bricks.length}\n`)
if (issues.length) {
  process.stderr.write(`几何自检发现 ${issues.length} 处问题:\n` + issues.map((x) => '  - ' + x).join('\n') + '\n')
  process.exit(2)
}
process.stderr.write('几何自检通过。\n')

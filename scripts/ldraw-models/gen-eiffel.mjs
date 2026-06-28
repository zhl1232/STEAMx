#!/usr/bin/env node
// 生成埃菲尔铁塔 LDraw 源模型（standard LEGO 件），按搭建说明 PDF 的 13 步组织。
// LDraw 约定：上 = -Y，砖原点在砖底，向上叠砖 = origin 递减；堆叠时 上层origin = 下层origin - 下层高。
// 4 重对称的塔：外八字腿(蓝/红) -> 灰平台 -> 收窄塔身(蓝/红交替) -> 中央蓝红条纹塔尖。
// 内置悬空/同层穿模自检，避免手摆坐标出错。
// 用法：node scripts/ldraw-models/gen-eiffel.mjs > scripts/ldraw-models/eiffel-tower.ldr

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRICK = 24
const PLATE = 8
const IDENT = '1 0 0 0 1 0 0 0 1'
const ROT90 = '0 0 1 0 1 0 -1 0 0' // 绕 Y 旋转 90°：把沿 X 的长边转到沿 Z

const COLOR = { green: 2, blue: 1, red: 4, gray: 71 }

const lines = []
const bricks = [] // { x0,x1,z0,z1, yTop, yBottom, decorative }
const steps = [] // 每步收集的 type-1 行

let current = []
function step(comment) {
  if (current.length) lines.push(...current, '0 STEP')
  current = []
  if (comment) current.push(`0 // ${comment}`)
}

// 放置一块零件：origin 在零件底面（yBottom = originY），向上(-Y)延伸 height。
function place({ color, part, cx, cz, originY, height, sizeX, sizeZ, along, decorative = false }) {
  const matrix = along === 'z' ? ROT90 : IDENT
  // footprint 按朝向决定长宽
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

// 2x4 砖
function brick24({ color, cx, cz, originY, along }) {
  place({ color, part: '3001.dat', cx, cz, originY, height: BRICK, sizeX: 80, sizeZ: 40, along })
}
// 2x2 砖
function brick22({ color, cx, cz, originY }) {
  place({ color, part: '3003.dat', cx, cz, originY, height: BRICK, sizeX: 40, sizeZ: 40, along: 'x' })
}
// 2x4 薄板
function plate24({ color, cx, cz, originY, along }) {
  place({ color, part: '3020.dat', cx, cz, originY, height: PLATE, sizeX: 80, sizeZ: 40, along })
}
// 8x8 薄板
function plate88(color, originY) {
  place({ color, part: '41539.dat', cx: 0, cz: 0, originY, height: PLATE, sizeX: 160, sizeZ: 160, along: 'x' })
}

// 4 重对称的外八字腿：每条腿 = 两块 2x4 拼成 L，开口朝中心。
function legLayer(color, originY) {
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      brick24({ color, cx: sx * 90, cz: sz * 30, originY, along: 'x' })
      brick24({ color, cx: sx * 30, cz: sz * 90, originY, along: 'z' })
    }
  }
}

// 6x6 风车圈（4 块 2x4，中心留 2x2 孔），可用砖或薄板。
function pinwheel(color, originY, kind = 'brick') {
  const put = kind === 'plate' ? plate24 : brick24
  put({ color, cx: -20, cz: -40, originY, along: 'x' }) // 北
  put({ color, cx: 40, cz: -20, originY, along: 'z' })  // 东
  put({ color, cx: 20, cz: 40, originY, along: 'x' })   // 南
  put({ color, cx: -40, cz: 20, originY, along: 'z' })  // 西
}

// 4 角立柱（2x2），落在风车圈的角上。
function cornerPosts(color, originY) {
  for (const sx of [1, -1]) for (const sz of [1, -1]) brick22({ color, cx: sx * 40, cz: sz * 40, originY })
}

// 4x4 实心（两块 2x4 并排）。
function solid44(color, originY) {
  brick24({ color, cx: 0, cz: -20, originY, along: 'x' })
  brick24({ color, cx: 0, cz: 20, originY, along: 'x' })
}

// 4x4 薄板平台（两块 2x4 薄板并排）。
function deck44(color, originY) {
  plate24({ color, cx: 0, cz: -20, originY, along: 'x' })
  plate24({ color, cx: 0, cz: 20, originY, along: 'x' })
}

// ---- 文件头 ----
lines.push(
  '0 LEGO Eiffel Tower (STEAM 课件 · 13 步搭建)',
  '0 Name: eiffel-tower.ldr',
  '0 Author: Arron',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-eiffel.mjs 生成；每个 0 STEP 对应搭建说明 PDF 的一页。',
)

let topY = 0 // 当前顶面（绿底板顶 = 0）

// Step 1: 绿色 32x32 底板 + 蓝色外八字腿（2 层）
step('Step 1: 绿色底板 + 4 条蓝色外八字腿（每条 L 形，叠 2 层）')
place({ color: COLOR.green, part: '3811.dat', cx: 0, cz: 0, originY: 0, height: 0, sizeX: 640, sizeZ: 640, along: 'x', decorative: true })
legLayer(COLOR.blue, topY); topY -= BRICK
legLayer(COLOR.blue, topY); topY -= BRICK

// Step 2: 红色腿层
step('Step 2: 在蓝腿上叠一层红色 2x4')
legLayer(COLOR.red, topY); topY -= BRICK

// Step 3: 灰色 8x8 平台
step('Step 3: 盖上灰色 8x8 平台，桥接 4 条腿')
plate88(COLOR.gray, topY); topY -= PLATE

// Step 4: 红色风车圈（2 层）
step('Step 4: 平台上叠红色风车圈（2 层）收窄塔身')
pinwheel(COLOR.red, topY); topY -= BRICK
pinwheel(COLOR.red, topY); topY -= BRICK

// Step 5: 蓝色 4 角立柱（2 层）
step('Step 5: 四角立起蓝色 2x2 柱（2 层）')
cornerPosts(COLOR.blue, topY); topY -= BRICK
cornerPosts(COLOR.blue, topY); topY -= BRICK

// Step 6: 第二块灰色 8x8 平台
step('Step 6: 盖上第二块灰色平台')
plate88(COLOR.gray, topY); topY -= PLATE

// Step 7: 蓝色风车圈（2 层）
step('Step 7: 叠蓝色风车圈（2 层）')
pinwheel(COLOR.blue, topY); topY -= BRICK
pinwheel(COLOR.blue, topY); topY -= BRICK

// Step 8: 红色薄板装饰带
step('Step 8: 加一圈红色 2x4 薄板装饰带')
pinwheel(COLOR.red, topY, 'plate'); topY -= PLATE

// Step 9: 蓝色 4x4 实心塔芯（2 层）
step('Step 9: 中央叠蓝色 4x4 实心塔芯（2 层）')
solid44(COLOR.blue, topY); topY -= BRICK
solid44(COLOR.blue, topY); topY -= BRICK

// Step 10: 蓝红条纹塔尖下段（2x2，4 块交替）
step('Step 10: 中央竖起蓝红条纹塔尖（下段 4 块 2x2 交替）')
for (let i = 0; i < 4; i++) { brick22({ color: i % 2 === 0 ? COLOR.blue : COLOR.red, cx: 0, cz: 0, originY: topY }); topY -= BRICK }

// Step 11: 顶部观景平台（4x4 灰色薄板）
step('Step 11: 塔尖上加一块灰色观景平台')
deck44(COLOR.gray, topY); topY -= PLATE

// Step 12: 塔尖上段 + 顶帽（2x2，3 块交替）
step('Step 12: 平台上接塔尖上段与顶帽（3 块 2x2 交替）')
for (let i = 0; i < 3; i++) { brick22({ color: i % 2 === 0 ? COLOR.blue : COLOR.red, cx: 0, cz: 0, originY: topY }); topY -= BRICK }

// Step 13: 完成
step('Step 13: 完成！这就是积木版埃菲尔铁塔')
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
  // 支撑：底面在地面（yBottom>=-EPS）或有零件顶面与它底面相接且覆盖≥20%
  if (b.yBottom < -EPS) {
    const supporters = bricks.slice(0, i).filter((c) => Math.abs(c.yTop - b.yBottom) < EPS)
    const area = supporters.reduce((s, c) => s + overlapArea(c, b), 0)
    const need = (b.x1 - b.x0) * (b.z1 - b.z0) * 0.2
    if (area < need) issues.push(`砖#${i} (y${b.yBottom}) 支撑不足: ${area.toFixed(0)}/${need.toFixed(0)}`)
  }
  // 同层穿模
  for (let j = 0; j < i; j++) {
    const o = bricks[j]
    if (o.decorative) continue
    if (Math.abs(o.yTop - b.yTop) < EPS && overlapArea(o, b) > EPS) {
      issues.push(`砖#${i} 与 砖#${j} 同层穿模 (y${b.yTop})`)
    }
  }
}

const out = lines.join('\n') + '\n'
const target = resolve(process.cwd(), 'scripts/ldraw-models/eiffel-tower.ldr')
writeFileSync(target, out, 'utf8')
process.stderr.write(`已写出 ${target}\n零件数: ${bricks.length - 1}（不含底板）\n`)
if (issues.length) {
  process.stderr.write(`几何自检发现 ${issues.length} 处问题:\n` + issues.map((x) => '  - ' + x).join('\n') + '\n')
  process.exit(2)
} else {
  process.stderr.write('几何自检通过：无悬空、无同层穿模。\n')
}

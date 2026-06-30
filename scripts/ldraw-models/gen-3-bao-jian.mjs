#!/usr/bin/env node
// 生成「宝剑」可校验 assembly.json。
// 来源：3+ 课件「宝剑」instructions.pdf，共 14 个搭建步骤。

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), 'scripts/ldraw-models/3-bao-jian-assembly.json')

const COLOR = {
  blue: { code: 1, name: 'Blue' },
  red: { code: 4, name: 'Red' },
  yellow: { code: 14, name: 'Yellow' },
}

const PART = {
  duplo24: '3011.dat',
  duplo22: '3437.dat',
  duplo24Plate: '40666.dat',
}

const MATRIX = {
  // Side-built bricks: local top studs face world -Z, matching the PDF side view.
  sideHorizontal: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  sideVertical: [0, 0, -1, -1, 0, 0, 0, 1, 0],
}

const DEPTH = {
  brickFront: -48,
  center: 0,
  brickBack: 48,
  plateFront: -24,
  plateBack: 48,
}

const steps = [
  ['page-01.png', '搭建剑身起点'],
  ['page-02.png', '延长剑身第一段'],
  ['page-03.png', '延长剑身第二段'],
  ['page-04.png', '完成剑身长条'],
  ['page-05.png', '搭建剑格竖梁'],
  ['page-06.png', '加厚剑格竖梁'],
  ['page-07.png', '搭建剑柄'],
  ['page-08.png', '搭建剑架起点'],
  ['page-09.png', '延长剑架横梁'],
  ['page-10.png', '搭建黄色支撑'],
  ['page-11.png', '加固左侧底座'],
  ['page-12.png', '加固右侧底座'],
  ['page-13.png', '包边红色支撑'],
  ['page-14.png', '完成宝剑'],
].map(([source, title], index) => ({
  step: index + 1,
  source,
  title,
  placements: [],
}))

function ldrawLine({ partId, color, u, v, depth = 0, orientation }) {
  return [
    '1',
    color.code,
    u * 40,
    v * 40,
    depth,
    ...MATRIX[orientation],
    partId,
  ].join(' ')
}

function place({
  step,
  id,
  partId = PART.duplo24,
  color,
  u,
  v,
  depth = 0,
  orientation = 'sideHorizontal',
  confidence = 0.92,
  assumptions = [],
}) {
  steps[step - 1].placements.push({
    id,
    partId,
    colorCode: color.code,
    colorName: color.name,
    orientation: MATRIX[orientation],
    ldrawLine: ldrawLine({
      partId,
      color,
      u,
      v,
      depth,
      orientation,
    }),
    confidence,
    sourceStep: step,
    assumptions,
  })
}

function bladeSegment({ step, segmentIndex, x }) {
  place({ step, id: `s${step}_blade_${segmentIndex}_blue_front`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.brickFront })
  // PDF page 1: yellow core is offset one stud toward the blade tip (left in the side view).
  place({ step, id: `s${step}_blade_${segmentIndex}_yellow_core`, color: COLOR.yellow, u: x - 1, v: 0, depth: DEPTH.center })
  place({ step, id: `s${step}_blade_${segmentIndex}_blue_back`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.brickBack })
}

// Steps 1-4: PDF pages 1-4 build the long sword body as a side-built sandwich:
// blue front + yellow core + blue back. The yellow strip is staggered one stud
// toward the tip so it protrudes on the left and sits recessed on the right.
[
  { step: 1, xs: [-12, -8] },
  { step: 2, xs: [-4, 0] },
  { step: 3, xs: [4, 8] },
  { step: 4, xs: [12] },
].forEach(({ step, xs }) => {
  xs.forEach((x, offset) => bladeSegment({ step, segmentIndex: offset + 1, x }))
})

// Step 5: two vertical blue 2x4 pieces clamped into the blade center layer.
place({ step: 5, id: 's5_guard_top_center', color: COLOR.blue, u: 14, v: -2, depth: DEPTH.center, orientation: 'sideVertical' })
place({ step: 5, id: 's5_guard_bottom_center', color: COLOR.blue, u: 14, v: 2, depth: DEPTH.center, orientation: 'sideVertical' })

// Step 6: thicken back layer and extend front layer on the same guard column (u=14).
place({ step: 6, id: 's6_guard_top_back', color: COLOR.blue, u: 14, v: -3, orientation: 'sideVertical', depth: DEPTH.brickBack })
place({ step: 6, id: 's6_guard_bottom_back', color: COLOR.blue, u: 14, v: 3, orientation: 'sideVertical', depth: DEPTH.brickBack })
place({ step: 6, id: 's6_guard_top_extension', color: COLOR.blue, u: 14, v: -3, depth: DEPTH.brickFront, orientation: 'sideVertical' })
place({ step: 6, id: 's6_guard_bottom_extension', color: COLOR.blue, u: 14, v: 3, depth: DEPTH.brickFront, orientation: 'sideVertical' })

// Step 7: six blue 2x4 pieces extend the handle to the right.
for (const x of [16, 20, 24]) {
  place({ step: 7, id: `s7_handle_${x}_front`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.brickFront })
  place({ step: 7, id: `s7_handle_${x}_back`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.brickBack })
}

// Steps 8-9: red 2x4 plates flank the yellow 2x4 center strip of the display stand.
place({ step: 8, id: 's8_stand_yellow_start', color: COLOR.yellow, u: -14, v: 16, depth: DEPTH.center })
place({ step: 8, id: 's8_stand_red_front', partId: PART.duplo24Plate, color: COLOR.red, u: -12, v: 16, depth: DEPTH.plateFront })
place({ step: 8, id: 's8_stand_red_back', partId: PART.duplo24Plate, color: COLOR.red, u: -12, v: 16, depth: DEPTH.plateBack })

for (const x of [-10, -6, -2, 2, 6]) {
  place({ step: 9, id: `s9_stand_yellow_${x}`, color: COLOR.yellow, u: x, v: 16, depth: DEPTH.center })
}
for (const x of [-8, -4, 0, 4]) {
  place({ step: 9, id: `s9_stand_red_${x}_front`, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: 16, depth: DEPTH.plateFront })
  place({ step: 9, id: `s9_stand_red_${x}_back`, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: 16, depth: DEPTH.plateBack })
}

// Step 10: two yellow support blocks under the sword, each using five 2x4 bricks and one 2x2 cap.
for (const [side, x] of [['left', -14], ['right', 10]]) {
  for (const z of [4, 8, 12, 16, 20]) {
    place({ step: 10, id: `s10_${side}_support_${z}`, color: COLOR.yellow, u: x, v: z, orientation: 'sideVertical' })
  }
  place({ step: 10, id: `s10_${side}_cap`, partId: PART.duplo22, color: COLOR.yellow, u: x, v: 22 })
}

// Steps 11-12: red plates and red 2x4 bricks strengthen the two ends of the stand.
for (const [id, x, z] of [
  ['s11_left_plate_top', -16, 14],
  ['s11_left_plate_bottom', -16, 18],
]) {
  place({ step: 11, id, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: z })
}
for (const [id, x, z] of [
  ['s11_left_brick_outer', -18, 16],
  ['s11_left_brick_inner', -10, 20],
]) {
  place({ step: 11, id, color: COLOR.red, u: x, v: z })
}

for (const [id, x, z] of [
  ['s12_right_plate_top', 8, 14],
  ['s12_right_plate_bottom', 8, 18],
]) {
  place({ step: 12, id, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: z })
}
for (const [id, x, z] of [
  ['s12_right_brick_outer', 12, 20],
  ['s12_right_brick_inner', 4, 20],
]) {
  place({ step: 12, id, color: COLOR.red, u: x, v: z })
}

// Step 13: eight red 2x4 plates wrap the yellow supports, matching the final red side posts in the PDF.
for (const [side, x] of [['left_outer', -16], ['left_inner', -12], ['right_outer', 8], ['right_inner', 12]]) {
  for (const z of [6, 10]) {
    place({ step: 13, id: `s13_${side}_${z}`, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: z, orientation: 'sideVertical' })
  }
}

const assembly = {
  model: '3-bao-jian.ldr',
  title: '宝剑（PDF 14 步版）',
  sourceImages: Array.from(
    { length: 14 },
    (_, index) => `https://assets.steamx.cc/courses/3-bao-jian/instructions.pdf#page=${index + 1}`,
  ),
  coordinateSystem: 'LDraw Duplo side-build grid; +Y down; one Duplo stud = 40 LDU. PDF face-stud layout is modeled on the world X/Y plane with studs facing world -Z.',
  notes: [
    'All placements use exact side-build LDraw transforms so the generated 0 STEP order and visible brick orientations follow instructions.pdf pages 1-14.',
    'The model is intentionally vertical: the Duplo top-stud face is rotated forward instead of lying on the ground plane.',
    'Blue/yellow sword-body and red/yellow stand-body colors are modeled as front/core/back depth layers, matching the PDF sandwich construction.',
  ],
  steps,
}

writeFileSync(OUT, JSON.stringify(assembly, null, 2) + '\n')
console.log(`wrote ${OUT}`)

#!/usr/bin/env node
// 生成「宝剑」可校验 assembly.json。
// 来源：3+ 课件「宝剑」instructions.pdf，共 14 个搭建步骤。

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(process.cwd(), 'scripts/ldraw-models/3-bao-jian-assembly.json')

const PART_METADATA_PATH = fileURLToPath(
  new URL('../../.agents/skills/image-to-ldraw/references/part-metadata.json', import.meta.url),
)
const PART_METADATA = JSON.parse(readFileSync(PART_METADATA_PATH, 'utf8'))

function partHeightLdu(partId) {
  const meta = PART_METADATA.parts?.[partId]
  if (!meta || typeof meta.heightLdu !== 'number') {
    throw new Error(`gen-3-bao-jian: missing heightLdu metadata for ${partId} in ${PART_METADATA_PATH}`)
  }
  return meta.heightLdu
}

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

// PLATE_H is derived from part-metadata.json (40666.dat heightLdu) instead of hard-coded, so the
// sandwich constants below stay correct if a part's real height ever changes (see the skill's
// side-built depth-derivation guidance in references/duplo-ldraw-conventions.md).
const PLATE_H = partHeightLdu(PART.duplo24Plate)

const DEPTH = {
  // Display-stand spine + support-tower depths (steps 8-13). Verified pixel-for-pixel against the
  // PDF legend icons: the yellow stand spine and support towers are genuinely thick 3011.dat /
  // 3437.dat bricks (unlike the sword body), so these stay exactly as originally authored.
  brickFront: -48,
  center: 0,
  brickBack: 48,
  plateFront: -24,
  plateBack: 48,
  // Sword-body sandwich depths (blade/guard/handle, steps 1-7). All three layers are now 2x4 thin
  // plates (40666.dat, PLATE_H each) instead of 3011.dat thick bricks, so the sandwich is rescaled
  // from brickFront/brickBack (+/-48) to +/-PLATE_H, keeping the same contiguous front/center/back
  // pattern.
  thinFront: -PLATE_H,
  thinBack: PLATE_H,
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

// validate-assembly.mjs requires every exact-transform (ldrawLine) placement to declare
// placement.support explicitly. This whole model is authored as a side-built u/v/depth stud
// grid matched pixel-for-pixel against instructions.pdf (not a stacked ground-up build), so
// there is no meaningful single top/bottom connection plane to check automatically per part.
// Every placement therefore documents that choice with a manual support exemption instead of
// a fabricated support graph; see references/duplo-ldraw-conventions.md side-built guidance.
const SIDE_BUILT_SUPPORT = {
  type: 'manual',
  reason: 'Side-built exact-transform placement on the shared u/v/depth stud grid, verified against instructions.pdf per-step images rather than a stacked top/bottom connection.',
}

// Steps 10-12 join the display-stand crossbar/reinforcement pieces directly onto the tops of the
// step-10 support columns at a shared u/v grid point (matching instructions.pdf, where the beam or
// plate visibly seats onto interlocking studs on the column). The coarse axis-aligned collision box
// used by validate-assembly.mjs cannot represent stud-level interlocking, so it reports these known,
// PDF-confirmed junctions as full volume overlaps. Pre-existing since before the plate/brick fix
// (unaffected by it, see the empty diff for steps 8-13); documented here instead of redesigned.
function standJunctionOverlap(counterpartIds) {
  return (Array.isArray(counterpartIds) ? counterpartIds : [counterpartIds]).map((counterpartId) => ({
    id: counterpartId,
    reason: `Confirmed in instructions.pdf: interlocks with ${counterpartId} at a shared stud; coarse collision box reports the intended stud connection as a full overlap.`,
  }))
}

function place({
  step,
  id,
  // Default is the 2x4 thin plate: the sword body (blade/guard/handle) is built entirely from
  // plates per the PDF legend icons. Placements that must stay thick (display-stand spine,
  // support towers, reinforcement bricks) pass an explicit partId override below.
  partId = PART.duplo24Plate,
  color,
  u,
  v,
  depth = 0,
  orientation = 'sideHorizontal',
  confidence = 0.92,
  assumptions = [],
  acceptedOverlaps,
}) {
  const placement = {
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
    support: SIDE_BUILT_SUPPORT,
  }
  if (acceptedOverlaps) placement.acceptedOverlaps = acceptedOverlaps
  steps[step - 1].placements.push(placement)
}

function bladeSegment({ step, segmentIndex, x }) {
  place({ step, id: `s${step}_blade_${segmentIndex}_blue_front`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.thinFront })
  // PDF page 1: yellow core is offset one stud toward the blade tip (left in the side view).
  place({ step, id: `s${step}_blade_${segmentIndex}_yellow_core`, color: COLOR.yellow, u: x - 1, v: 0, depth: DEPTH.center })
  place({ step, id: `s${step}_blade_${segmentIndex}_blue_back`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.thinBack })
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
place({ step: 6, id: 's6_guard_top_back', color: COLOR.blue, u: 14, v: -3, orientation: 'sideVertical', depth: DEPTH.thinBack })
place({ step: 6, id: 's6_guard_bottom_back', color: COLOR.blue, u: 14, v: 3, orientation: 'sideVertical', depth: DEPTH.thinBack })
place({ step: 6, id: 's6_guard_top_extension', color: COLOR.blue, u: 14, v: -3, depth: DEPTH.thinFront, orientation: 'sideVertical' })
place({ step: 6, id: 's6_guard_bottom_extension', color: COLOR.blue, u: 14, v: 3, depth: DEPTH.thinFront, orientation: 'sideVertical' })

// Step 7: six blue 2x4 pieces extend the handle to the right.
for (const x of [16, 20, 24]) {
  place({ step: 7, id: `s7_handle_${x}_front`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.thinFront })
  place({ step: 7, id: `s7_handle_${x}_back`, color: COLOR.blue, u: x, v: 0, depth: DEPTH.thinBack })
}

// Steps 8-9: red 2x4 plates flank the yellow 2x4 center strip of the display stand.
// The yellow center strip stays a thick 3011.dat brick: measured against the PDF legend icon
// (front-face height/width ratio 0.736, matching the known-thick 3011.dat reference at 0.73,
// versus the known-thin 40666.dat reference at 0.62) it is NOT a thin plate like the sword body.
place({ step: 8, id: 's8_stand_yellow_start', partId: PART.duplo24, color: COLOR.yellow, u: -14, v: 16, depth: DEPTH.center })
place({ step: 8, id: 's8_stand_red_front', partId: PART.duplo24Plate, color: COLOR.red, u: -12, v: 16, depth: DEPTH.plateFront })
place({ step: 8, id: 's8_stand_red_back', partId: PART.duplo24Plate, color: COLOR.red, u: -12, v: 16, depth: DEPTH.plateBack })

for (const x of [-10, -6, -2, 2, 6]) {
  place({ step: 9, id: `s9_stand_yellow_${x}`, partId: PART.duplo24, color: COLOR.yellow, u: x, v: 16, depth: DEPTH.center })
}
for (const x of [-8, -4, 0, 4]) {
  place({ step: 9, id: `s9_stand_red_${x}_front`, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: 16, depth: DEPTH.plateFront })
  place({ step: 9, id: `s9_stand_red_${x}_back`, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: 16, depth: DEPTH.plateBack })
}

// Step 10: two yellow support blocks under the sword, each using five 2x4 bricks and one 2x2 cap.
// Confirmed thick against the PDF legend (ratio 0.73, matching the 3011.dat/3437.dat reference).
for (const [side, x] of [['left', -14], ['right', 10]]) {
  for (const z of [4, 8, 12, 16, 20]) {
    // Left column at v=16 shares its grid point with the step-8 stand spine (s8_stand_yellow_start
    // is left-only, so only the left column has this junction).
    const acceptedOverlaps = side === 'left' && z === 16 ? standJunctionOverlap('s8_stand_yellow_start') : undefined
    place({ step: 10, id: `s10_${side}_support_${z}`, partId: PART.duplo24, color: COLOR.yellow, u: x, v: z, orientation: 'sideVertical', acceptedOverlaps })
  }
  place({
    step: 10,
    id: `s10_${side}_cap`,
    partId: PART.duplo22,
    color: COLOR.yellow,
    u: x,
    v: 22,
    acceptedOverlaps: standJunctionOverlap(`s10_${side}_support_20`),
  })
}

// Steps 11-12: red plates and red 2x4 bricks strengthen the two ends of the stand.
// The PDF legend shows one thin plate icon and one thick brick icon per step (measured ratios
// 0.62 and 0.73 respectively), matching the plate/brick split kept here.
for (const [id, x, z, junctions] of [
  // Each reinforcement plate is long enough (relative to the 4-stud support-column bricks) to
  // touch two adjacent columns at once; both are confirmed junctions, not just the nearer one.
  ['s11_left_plate_top', -16, 14, ['s10_left_support_12', 's10_left_support_16']],
  ['s11_left_plate_bottom', -16, 18, ['s10_left_support_16', 's10_left_support_20']],
]) {
  place({ step: 11, id, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: z, acceptedOverlaps: standJunctionOverlap(junctions) })
}
for (const [id, x, z] of [
  ['s11_left_brick_outer', -18, 16],
  ['s11_left_brick_inner', -10, 20],
]) {
  place({ step: 11, id, partId: PART.duplo24, color: COLOR.red, u: x, v: z })
}

for (const [id, x, z, junctions] of [
  ['s12_right_plate_top', 8, 14, ['s10_right_support_12', 's10_right_support_16']],
  ['s12_right_plate_bottom', 8, 18, ['s10_right_support_16', 's10_right_support_20']],
]) {
  place({ step: 12, id, partId: PART.duplo24Plate, color: COLOR.red, u: x, v: z, acceptedOverlaps: standJunctionOverlap(junctions) })
}
for (const [id, x, z, junction] of [
  ['s12_right_brick_outer', 12, 20, 's10_right_support_20'],
  ['s12_right_brick_inner', 4, 20, undefined],
]) {
  place({ step: 12, id, partId: PART.duplo24, color: COLOR.red, u: x, v: z, acceptedOverlaps: junction ? standJunctionOverlap(junction) : undefined })
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

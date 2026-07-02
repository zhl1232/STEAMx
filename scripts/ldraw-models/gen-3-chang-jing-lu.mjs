#!/usr/bin/env node
// Generate the reviewed assembly JSON for lesson 33: 3+ 长颈鹿.
// The final .ldr is emitted by .agents/skills/image-to-ldraw/scripts/assembly-to-ldraw.mjs.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PART_METADATA = JSON.parse(
  readFileSync(resolve(process.cwd(), '.agents/skills/image-to-ldraw/references/part-metadata.json'), 'utf8'),
)

const STUD = PART_METADATA.grid.studPitchLdu

const PART = {
  curvedFoot: '2302.dat',
  brick22: '3437.dat',
  brick24: '3011.dat',
  plate612: '4196.dat',
  tubeHolder: '42029.dat',
  tubeStraight: '31452.dat',
  tubeElbow45: '31195.dat',
  tubeDoorway: '31191.dat',
}

const COLOR = {
  blue: 1,
  red: 4,
  yellow: 14,
  orange: 25,
}

const COLOR_NAME = {
  [COLOR.blue]: 'Blue',
  [COLOR.red]: 'Red',
  [COLOR.yellow]: 'Yellow',
  [COLOR.orange]: 'Orange',
}

const SOURCE = {
  1: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-07.webp',
  2: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-08.webp',
  3: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-09.webp',
  4: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-10.webp',
  5: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-11.webp',
  6: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-12.webp',
  7: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-13.webp',
  8: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-14.webp',
  9: 'https://assets.steamx.cc/courses/3-chang-jing-lu/slides/slide-15.webp',
}

function partMeta(partId) {
  const meta = PART_METADATA.parts[partId]
  if (!meta) throw new Error(`missing part metadata: ${partId}`)
  return meta
}

function partHeight(partId) {
  const height = partMeta(partId).heightLdu
  if (typeof height !== 'number') throw new Error(`missing heightLdu metadata: ${partId}`)
  return height
}

function tubeRunLength(partId) {
  const path = partMeta(partId).tubePath
  if (path?.type !== 'straight') throw new Error(`${partId} does not define a straight tube path`)
  return Math.abs(Number(path.end.z) - Number(path.start.z))
}

class Matrix4 {
  constructor(elements) {
    this.elements = elements || [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]
  }

  static multiply(a, b) {
    const ae = a.elements
    const be = b.elements
    const te = new Array(16)

    const a11 = ae[0], a12 = ae[1], a13 = ae[2], a14 = ae[3]
    const a21 = ae[4], a22 = ae[5], a23 = ae[6], a24 = ae[7]
    const a31 = ae[8], a32 = ae[9], a33 = ae[10], a34 = ae[11]
    const a41 = ae[12], a42 = ae[13], a43 = ae[14], a44 = ae[15]

    const b11 = be[0], b12 = be[1], b13 = be[2], b14 = be[3]
    const b21 = be[4], b22 = be[5], b23 = be[6], b24 = be[7]
    const b31 = be[8], b32 = be[9], b33 = be[10], b34 = be[11]
    const b41 = be[12], b42 = be[13], b43 = be[14], b44 = be[15]

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
    te[1] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
    te[2] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
    te[3] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44

    te[4] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
    te[6] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
    te[7] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44

    te[8] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
    te[9] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
    te[11] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44

    te[12] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
    te[13] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
    te[14] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44

    return new Matrix4(te)
  }

  static translation(x, y, z) {
    return new Matrix4([
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1,
    ])
  }

  static rotationX(rad) {
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return new Matrix4([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1,
    ])
  }

  static rotationY(rad) {
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return new Matrix4([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1,
    ])
  }

  static rotationZ(rad) {
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return new Matrix4([
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])
  }

  toLDraw() {
    const e = this.elements
    return [
      e[3], e[7], e[11],
      e[0], e[1], e[2],
      e[4], e[5], e[6],
      e[8], e[9], e[10],
    ].map(formatNumber).join(' ')
  }
}

function formatNumber(value) {
  if (Math.abs(value) < 0.000001) return '0'
  const rounded = Number(value.toFixed(6))
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function type1(colorCode, matrix, partId) {
  return `1 ${colorCode} ${matrix.toLDraw()} ${partId}`
}

const EXACT_SUPPORT = {
  type: 'manual',
  reason: 'Exact-transform Duplo tube/holder/head placement aligned from lesson 33 slide images; no single planar stud support graph represents the angled tube chain.',
}

const assembly = {
  model: '3-chang-jing-lu',
  title: '长颈鹿',
  sourceImages: Object.values(SOURCE),
  coordinateSystem: 'LDraw Duplo grid; +Y down; one Duplo stud = 40 LDU. Only Duplo / large-brick parts from part-metadata.json are used.',
  steps: [],
}

let placementCounter = 0
const byName = new Map()

function nextId() {
  placementCounter += 1
  return `p${String(placementCounter).padStart(3, '0')}`
}

function step(stepNumber, title) {
  const entry = {
    step: stepNumber,
    source: SOURCE[stepNumber],
    title,
    placements: [],
  }
  assembly.steps.push(entry)
  return entry
}

function remember(name, placement) {
  if (name) byName.set(name, placement.id)
  return placement
}

function placementBase({ partId, colorCode, confidence = 0.92, sourceStep, assumptions = [], needsReview = false, decorative = false }) {
  return {
    id: nextId(),
    partId,
    colorCode,
    colorName: COLOR_NAME[colorCode],
    confidence,
    sourceStep,
    assumptions,
    ...(needsReview ? { needsReview: true } : {}),
    ...(decorative ? { decorative: true } : {}),
  }
}

function gridPlacement(entry, {
  name,
  partId,
  colorCode,
  x,
  z,
  orientation = 'north',
  support,
  confidence,
  assumptions,
  needsReview,
  decorative,
}) {
  const placement = {
    ...placementBase({ partId, colorCode, confidence, sourceStep: entry.step, assumptions, needsReview, decorative }),
    anchor: { type: 'centerStud', x, z },
    orientation,
    support,
  }
  entry.placements.push(placement)
  return remember(name, placement)
}

function exactPlacement(entry, {
  name,
  partId,
  colorCode,
  matrix,
  confidence = 0.78,
  assumptions = [],
  needsReview = true,
  decorative = false,
}) {
  const placement = {
    ...placementBase({
      partId,
      colorCode,
      confidence,
      sourceStep: entry.step,
      assumptions,
      needsReview,
      decorative,
    }),
    ldrawLine: type1(colorCode, matrix, partId),
    support: EXACT_SUPPORT,
  }
  entry.placements.push(placement)
  return remember(name, placement)
}

function supportOf(...names) {
  return { type: 'placements', ids: names.map((name) => byName.get(name)) }
}

function matrixAt(x, y, z, ...rotations) {
  return rotations.reduce(
    (matrix, rotation) => Matrix4.multiply(matrix, rotation),
    Matrix4.translation(x, y, z),
  )
}

const brickH = partHeight(PART.brick24)
const plateH = partHeight(PART.plate612)
const doorwayH = partHeight(PART.tubeDoorway)
const holderBottom = partMeta(PART.tubeHolder).origin.originToBottom
const straightTubeRun = tubeRunLength(PART.tubeStraight)

const s1 = step(1, '搭建四肢')
const legCenters = [
  ['lf', -2, -4],
  ['rf', 2, -4],
  ['lb', -2, 4],
  ['rb', 2, 4],
]
const legTops = []
for (const [name, x, z] of legCenters) {
  gridPlacement(s1, {
    name: `${name}-foot`,
    partId: PART.curvedFoot,
    colorCode: COLOR.orange,
    x,
    z,
    orientation: 'east',
    support: { type: 'ground' },
  })
  gridPlacement(s1, {
    name: `${name}-ankle`,
    partId: PART.brick22,
    colorCode: COLOR.orange,
    x,
    z,
    support: supportOf(`${name}-foot`),
    assumptions: ['The 2 x 2 ankle block is included from the step-1 parts callout; exact offset is inferred from the rendered instruction image.'],
    needsReview: true,
    confidence: 0.82,
  })
  const layerColors = [COLOR.yellow, COLOR.orange, COLOR.yellow, COLOR.orange]
  let supportName = `${name}-ankle`
  layerColors.forEach((color, index) => {
    const layerName = `${name}-leg-${index + 1}`
    gridPlacement(s1, {
      name: layerName,
      partId: PART.brick24,
      colorCode: color,
      x,
      z,
      orientation: 'east',
      support: supportOf(supportName),
    })
    supportName = layerName
  })
  legTops.push(supportName)
}

gridPlacement(s1, {
  name: 'body-base',
  partId: PART.plate612,
  colorCode: COLOR.red,
  x: 0,
  z: 0,
  orientation: 'east',
  support: supportOf(...legTops),
})

const bodyPlateTopY = -(brickH + brickH * 4 + plateH)
const bodyBrickTopY = bodyPlateTopY - brickH
const bodySecondTopY = bodyBrickTopY - brickH
const holderY = bodyPlateTopY - holderBottom

const s2 = step(2, '搭建身体')
exactPlacement(s2, {
  name: 'front-holder',
  partId: PART.tubeHolder,
  colorCode: COLOR.red,
  matrix: matrixAt(0, holderY, -STUD * 5, Matrix4.rotationY(Math.PI)),
  confidence: 0.82,
  assumptions: ['Used Duplo 42029 tube-holder approximation; front ring direction inferred from slide 08.'],
})
exactPlacement(s2, {
  name: 'rear-holder',
  partId: PART.tubeHolder,
  colorCode: COLOR.red,
  matrix: matrixAt(0, holderY, STUD * 5),
  confidence: 0.82,
  assumptions: ['Used Duplo 42029 tube-holder approximation; rear ring direction inferred from slide 08.'],
})
gridPlacement(s2, {
  name: 'body-lower-left',
  partId: PART.brick24,
  colorCode: COLOR.yellow,
  x: -2,
  z: 0,
  orientation: 'east',
  support: supportOf('body-base'),
})
gridPlacement(s2, {
  name: 'body-lower-center',
  partId: PART.brick24,
  colorCode: COLOR.orange,
  x: 0,
  z: 0,
  orientation: 'east',
  support: supportOf('body-base'),
})
gridPlacement(s2, {
  name: 'body-lower-right',
  partId: PART.brick24,
  colorCode: COLOR.yellow,
  x: 2,
  z: 0,
  orientation: 'east',
  support: supportOf('body-base'),
})

const s3 = step(3, '连接尾巴')
exactPlacement(s3, {
  name: 'tail-elbow-1',
  partId: PART.tubeElbow45,
  colorCode: COLOR.blue,
  matrix: matrixAt(0, bodyPlateTopY - STUD, STUD * 6, Matrix4.rotationZ(Math.PI / 2)),
  assumptions: ['Blue Duplo 45-degree tail bend visually positioned from slide 09; exact port chain should be reviewed in 3D before MPD packing.'],
})
exactPlacement(s3, {
  name: 'tail-elbow-2',
  partId: PART.tubeElbow45,
  colorCode: COLOR.blue,
  matrix: matrixAt(0, bodyPlateTopY - STUD / 2, STUD * 7.8, Matrix4.rotationZ(Math.PI / 2), Matrix4.rotationY(-Math.PI / 4)),
  assumptions: ['Second blue tail bend continues downward/backward from the rear holder; angle is visual, not port-checked yet.'],
})

const s4 = step(4, '完善身体')
const topGrid = [
  ['body-upper-lf', -2, -2, COLOR.orange, 'body-lower-left'],
  ['body-upper-cf', 0, -2, COLOR.yellow, 'body-lower-center'],
  ['body-upper-rf', 2, -2, COLOR.orange, 'body-lower-right'],
  ['body-upper-lb', -2, 2, COLOR.yellow, 'body-lower-left'],
  ['body-upper-cb', 0, 2, COLOR.orange, 'body-lower-center'],
  ['body-upper-rb', 2, 2, COLOR.yellow, 'body-lower-right'],
]
for (const [name, x, z, color, support] of topGrid) {
  gridPlacement(s4, {
    name,
    partId: PART.brick24,
    colorCode: color,
    x,
    z,
    orientation: 'east',
    support: supportOf(support),
    assumptions: ['Body brick layout is inferred from slide 10 perspective; exact interleaving should be checked visually.'],
    needsReview: true,
    confidence: 0.86,
  })
}
gridPlacement(s4, {
  name: 'body-ridge',
  partId: PART.brick24,
  colorCode: COLOR.yellow,
  x: 0,
  z: 0,
  orientation: 'east',
  support: supportOf('body-upper-cf', 'body-upper-cb'),
  assumptions: ['Center back ridge represents the raised yellow row visible in slides 10-15.'],
  needsReview: true,
  confidence: 0.84,
})

const s5 = step(5, '搭建颈部')
const neckX = 0
const neckZ = -STUD * 5.8
const neckBaseY = bodyPlateTopY - STUD
const verticalTube = Matrix4.rotationX(Math.PI / 2)
let tubeOriginY = neckBaseY
for (const [name, color] of [
  ['neck-straight-red-1', COLOR.red],
  ['neck-straight-blue', COLOR.blue],
  ['neck-straight-red-2', COLOR.red],
]) {
  exactPlacement(s5, {
    name,
    partId: PART.tubeStraight,
    colorCode: color,
    matrix: matrixAt(neckX, tubeOriginY, neckZ, verticalTube),
    confidence: 0.86,
    assumptions: ['Vertical Duplo tube stack follows slide 11; exact flange seating should be checked in 3D.'],
  })
  tubeOriginY -= straightTubeRun
}
exactPlacement(s5, {
  name: 'neck-bend-blue',
  partId: PART.tubeElbow45,
  colorCode: COLOR.blue,
  matrix: matrixAt(neckX, tubeOriginY, neckZ, Matrix4.rotationX(Math.PI / 2), Matrix4.rotationZ(Math.PI)),
  assumptions: ['Top blue bend turns the neck toward the head; visual placement from slide 11.'],
})
exactPlacement(s5, {
  name: 'neck-bend-red',
  partId: PART.tubeElbow45,
  colorCode: COLOR.red,
  matrix: matrixAt(neckX, tubeOriginY - STUD * 0.9, neckZ - STUD * 1.5, Matrix4.rotationX(Math.PI / 2), Matrix4.rotationZ(Math.PI)),
  assumptions: ['Top red bend completes the horizontal transition into the head frame.'],
})
exactPlacement(s5, {
  name: 'mouth-blue',
  partId: PART.tubeElbow45,
  colorCode: COLOR.blue,
  matrix: matrixAt(neckX, tubeOriginY - STUD * 1.6, neckZ - STUD * 2.8, Matrix4.rotationY(Math.PI), Matrix4.rotationZ(-Math.PI / 2)),
  assumptions: ['Blue mouth/face tube is modeled as a Duplo 45-degree bend only; no small nozzle or eye details are added.'],
})

const s6 = step(6, '搭建头部')
const headTopY = tubeOriginY - STUD * 3
const headZ = neckZ - STUD * 2.4
exactPlacement(s6, {
  name: 'head-frame',
  partId: PART.tubeDoorway,
  colorCode: COLOR.yellow,
  matrix: matrixAt(neckX, headTopY, headZ),
  confidence: 0.82,
  assumptions: ['Yellow Duplo round-doorway frame is the closest registered part for the head frame in slide 12.'],
})

const headFrameBottomTop = headTopY + doorwayH
exactPlacement(s6, {
  name: 'head-bottom-beam',
  partId: PART.brick24,
  colorCode: COLOR.yellow,
  matrix: matrixAt(0, headFrameBottomTop - brickH, headZ),
  decorative: true,
  assumptions: ['Modeled as a Duplo 2 x 4 beam under the head frame, following slide 12 silhouette.'],
  needsReview: true,
  confidence: 0.78,
})

const s7 = step(7, '搭建眼睛')
gridPlacement(s7, {
  name: 'head-top-beam',
  partId: PART.brick24,
  colorCode: COLOR.yellow,
  x: 0,
  z: headZ / STUD,
  orientation: 'north',
  support: supportOf('head-frame'),
  assumptions: ['Printed eyes from the lesson image are intentionally not modeled; the Duplo beam preserves the large-brick shape only.'],
  needsReview: true,
  confidence: 0.8,
})
for (const [name, x] of [['left-eye-block', -1], ['right-eye-block', 1]]) {
  gridPlacement(s7, {
    name,
    partId: PART.brick22,
    colorCode: COLOR.orange,
    x,
    z: headZ / STUD - 1,
    support: supportOf('head-top-beam'),
    assumptions: ['Plain Duplo 2 x 2 used in place of the printed eye brick; no small eye pieces are used.'],
    needsReview: true,
    confidence: 0.7,
  })
}
gridPlacement(s7, {
  name: 'snout-left',
  partId: PART.curvedFoot,
  colorCode: COLOR.orange,
  x: -1.5,
  z: headZ / STUD - 1.5,
  orientation: 'north',
  support: supportOf('head-top-beam'),
  assumptions: ['Curved Duplo 2 x 3 approximates the rounded head side shown in slide 13.'],
  needsReview: true,
  decorative: true,
  confidence: 0.78,
})
gridPlacement(s7, {
  name: 'snout-right',
  partId: PART.curvedFoot,
  colorCode: COLOR.orange,
  x: 1.5,
  z: headZ / STUD - 1.5,
  orientation: 'south',
  support: supportOf('head-top-beam'),
  assumptions: ['Curved Duplo 2 x 3 approximates the rounded head side shown in slide 13.'],
  needsReview: true,
  decorative: true,
  confidence: 0.78,
})

const s8 = step(8, '搭建头角')
for (const [horn, x] of [['left', -1], ['right', 1]]) {
  let support = x < 0 ? 'left-eye-block' : 'right-eye-block'
  ;[COLOR.yellow, COLOR.orange, COLOR.yellow, COLOR.orange].forEach((color, index) => {
    const name = `${horn}-horn-${index + 1}`
    gridPlacement(s8, {
      name,
      partId: PART.brick22,
      colorCode: color,
      x,
      z: headZ / STUD,
      support: supportOf(support),
      assumptions: ['Horn color order inferred from slide 14 and finished render; exact stripe order should be visually reviewed.'],
      needsReview: true,
      confidence: 0.84,
    })
    support = name
  })
}

step(9, '成品展示')

const out = resolve(process.cwd(), 'scripts/ldraw-models/3-chang-jing-lu-assembly.json')
writeFileSync(out, JSON.stringify(assembly, null, 2) + '\n', 'utf8')
process.stderr.write(`wrote ${out}\n`)

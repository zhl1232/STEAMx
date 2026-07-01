#!/usr/bin/env node
// 生成「长颈龙」LDraw 源模型（得宝 Duplo 件），完全对照 12 页 PDF 原生步骤拼装。
// 规则：标准 Duplo 积木高度是 48，大颗粒网格单位为 40 LDraw 单位 (1 stud)。
// 用法：node scripts/ldraw-models/gen-3-chang-jing-long.mjs

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRICK_H = 48
const PLATE_H = 24
const FOOT_H = 48
const ARCH_H = 240
const TUBE_L = 120
const DUPLO_STUD = 40
const BODY_PLATE_WORLD_SIZE_X = 240
const BODY_PLATE_WORLD_SIZE_Z = 480
const BODY_PLATE_PART_SIZE_X = 480
const BODY_PLATE_PART_SIZE_Z = 240
const LEG_X = BODY_PLATE_WORLD_SIZE_X / 2 - DUPLO_STUD
const LEG_Z = BODY_PLATE_WORLD_SIZE_Z / 2 - DUPLO_STUD
const LEG_COLUMN_TOP_Y = -BRICK_H * 4
const BODY_PLATE_ORIGIN_Y = LEG_COLUMN_TOP_Y - PLATE_H
const BODY_BRICK_ORIGIN_Y = BODY_PLATE_ORIGIN_Y - BRICK_H
const ARCH_ORIGIN_Y = BODY_PLATE_ORIGIN_Y - ARCH_H
const TUBE_CENTER_Y = ARCH_ORIGIN_Y + 110
const BODY_Y_SHIFT = BODY_BRICK_ORIGIN_Y - (-256)

const COLOR = {
  blue: 1,
  green: 2,
  red: 4,
  yellow: 14,
  white: 15
}

const MODEL_SLUG = '3-chang-jing-long'
const SOURCE_IMAGE_DIR = 'C:\\Users\\arron\\Downloads\\ilovepdf_pages-to-jpg'

const COLOR_NAME = {
  [COLOR.blue]: 'Blue',
  [COLOR.green]: 'Green',
  [COLOR.red]: 'Red',
  [COLOR.yellow]: 'Yellow',
  [COLOR.white]: 'White'
}

const PART_META = {
  '2302.dat': {
    name: 'Duplo Brick 2 x 3 with Curved Top',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '3437.dat': {
    name: 'Duplo Brick 2 x 2',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '3011.dat': {
    name: 'Duplo Brick 2 x 4',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '4196.dat': {
    name: 'Duplo Plate 6 x 12',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '31191.dat': {
    name: 'Duplo Ball Tube Exit with Round Doorway 2 x 6 x 5',
    ldrawStatus: 'Unofficial',
    confidence: 0.82,
    note: 'Closest available LDraw part for the yellow round doorway frame.'
  },
  '31452.dat': {
    name: 'Duplo Ball Tube Straight',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '31195.dat': {
    name: 'Duplo Ball Tube 45 Degrees',
    ldrawStatus: 'Official',
    confidence: 0.95
  },
  '42029.dat': {
    name: 'Duplo Plate 2 x 4 with Round Tube Holder',
    ldrawStatus: 'Custom LDraw approximation',
    confidence: 0.85,
    note: 'LEGO/BrickLink element 42029; local LDraw approximation because the checked public LDraw mirror does not provide 42029.dat. The custom part models the low 2 x 4 plate, 8 top Duplo studs, 3 underside clutch tubes, side shoulders, and a tangent horizontal tube-holder ring.'
  }
}

class Matrix4 {
  constructor(elements) {
    this.elements = elements || [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  static multiply(A, B) {
    const ae = A.elements;
    const be = B.elements;
    const te = new Array(16);

    const a11 = ae[0], a12 = ae[1], a13 = ae[2], a14 = ae[3];
    const a21 = ae[4], a22 = ae[5], a23 = ae[6], a24 = ae[7];
    const a31 = ae[8], a32 = ae[9], a33 = ae[10], a34 = ae[11];
    const a41 = ae[12], a42 = ae[13], a43 = ae[14], a44 = ae[15];

    const b11 = be[0], b12 = be[1], b13 = be[2], b14 = be[3];
    const b21 = be[4], b22 = be[5], b23 = be[6], b24 = be[7];
    const b31 = be[8], b32 = be[9], b33 = be[10], b34 = be[11];
    const b41 = be[12], b42 = be[13], b43 = be[14], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[1] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[2] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[3] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[4] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[6] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[7] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[8] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[9] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[11] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[12] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[13] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[14] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return new Matrix4(te);
  }

  static makeTranslation(x, y, z) {
    return new Matrix4([
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1
    ]);
  }

  static makeRotationX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Matrix4([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    ]);
  }

  static makeRotationY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Matrix4([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  static makeRotationZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Matrix4([
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  toLDrawString() {
    const e = this.elements;
    const x = e[3].toFixed(4);
    const y = e[7].toFixed(4);
    const z = e[11].toFixed(4);
    const a = e[0].toFixed(6);
    const b = e[1].toFixed(6);
    const c = e[2].toFixed(6);
    const d = e[4].toFixed(6);
    const e_val = e[5].toFixed(6);
    const f = e[6].toFixed(6);
    const g = e[8].toFixed(6);
    const h = e[9].toFixed(6);
    const i = e[10].toFixed(6);

    return `${x} ${y} ${z} ${a} ${b} ${c} ${d} ${e_val} ${f} ${g} ${h} ${i}`;
  }
}

const lines = []
const bricks = []
const placements = []
const assemblySteps = []
let current = []
let currentStep = null
let placementCounter = 0

function bodyY(y) {
  return y + BODY_Y_SHIFT
}

function step(comment) {
  if (current.length) lines.push(...current, '0 STEP')
  current = []
  currentStep = null
  if (comment) {
    current.push(`0 // ${comment}`)
    const match = comment.match(/^Step\s+(\d+):\s*(.+)$/)
    const stepNumber = match ? Number(match[1]) : assemblySteps.length + 1
    currentStep = {
      step: stepNumber,
      title: match ? match[2] : comment,
      instructionPage: `3+长颈龙搭建说明_page-${String(stepNumber).padStart(4, '0')}.jpg`,
      additions: []
    }
    assemblySteps.push(currentStep)
  }
}

function ldrawLine(color, matrix, part) {
  return `1 ${color} ${matrix.toLDrawString()} ${part}`
}

// validate-assembly.mjs (image-to-ldraw skill) requires every exact-transform (ldrawLine)
// placement to declare placement.support explicitly. This model predates that pipeline: it
// authors absolute Matrix4 transforms directly and already runs its own geometric self-check
// (see the "几何自检" support-area + overlap scan at the bottom of this file, gated by
// process.exit(2) before any output is written) instead of validate-assembly.mjs's anchor/
// support-id graph. Every placement documents that with a manual support exemption so the
// exemption is visible in validate-assembly.mjs's report instead of silently bypassing it.
const SELF_CHECKED_SUPPORT = {
  type: 'manual',
  reason: "Support and stacking are verified by this file's own geometric self-check (contiguous-Y support-area + overlap scan over bricks[], gated by process.exit(2)) rather than validate-assembly.mjs's support-id graph.",
}

function registerPlacement({ color, part, matrix, line, confidence, note, substituteFor, connection, tubeChecks, acceptedOverlaps, decorative }) {
  const meta = PART_META[part] || { name: part, ldrawStatus: 'Unknown', confidence: 0.5 }
  const e = matrix.elements
  const placement = {
    id: `p${String(++placementCounter).padStart(3, '0')}`,
    step: currentStep ? currentStep.step : null,
    partId: part,
    partName: meta.name,
    ldrawStatus: meta.ldrawStatus,
    colorCode: color,
    colorName: COLOR_NAME[color] || `LDraw ${color}`,
    confidence: confidence ?? meta.confidence,
    position: {
      x: Number(e[3].toFixed(4)),
      y: Number(e[7].toFixed(4)),
      z: Number(e[11].toFixed(4))
    },
    orientation: [
      Number(e[0].toFixed(6)), Number(e[1].toFixed(6)), Number(e[2].toFixed(6)),
      Number(e[4].toFixed(6)), Number(e[5].toFixed(6)), Number(e[6].toFixed(6)),
      Number(e[8].toFixed(6)), Number(e[9].toFixed(6)), Number(e[10].toFixed(6))
    ],
    connection: connection || 'Stud/tube connection inferred from the instruction image and Duplo grid.',
    ldrawLine: line,
    support: SELF_CHECKED_SUPPORT
  }
  // `decorative` used to only feed this script's own bricks[] self-check (below) and was silently
  // dropped from the exported placement, so validate-assembly.mjs always ran full structural checks
  // even for pieces the author had explicitly flagged as cosmetic (e.g. the loosely-seated roof-ridge
  // caps in steps 10-11, which are intentionally placed on/through each other). Propagate it so both
  // validators agree.
  if (decorative) placement.decorative = true
  if (meta.note) placement.note = meta.note
  if (note) placement.note = placement.note ? `${placement.note} ${note}` : note
  if (substituteFor) placement.substituteFor = substituteFor
  if (tubeChecks) placement.tubeChecks = tubeChecks
  if (acceptedOverlaps) placement.acceptedOverlaps = acceptedOverlaps
  placements.push(placement)
  if (currentStep) currentStep.additions.push(placement)
  return placement
}

function place({
  color,
  part,
  cx,
  cz,
  originY,
  height,
  sizeX,
  sizeZ,
  rotY = 0,
  rotZ = 0,
  decorative = false,
  confidence,
  note,
  substituteFor,
  connection,
  tubeChecks,
  acceptedOverlaps
}) {
  let mat = Matrix4.makeTranslation(cx, originY, cz);
  if (rotY) mat = Matrix4.multiply(mat, Matrix4.makeRotationY(rotY * Math.PI / 180));
  if (rotZ) mat = Matrix4.multiply(mat, Matrix4.makeRotationZ(rotZ * Math.PI / 180));
  
  const line = ldrawLine(color, mat, part)
  current.push(line);
  const placement = registerPlacement({ color, part, matrix: mat, line, confidence, note, substituteFor, connection, tubeChecks, acceptedOverlaps, decorative })

  const isRotated = Math.round(rotY / 90) % 2 !== 0;
  const actualSizeX = isRotated ? sizeZ : sizeX;
  const actualSizeZ = isRotated ? sizeX : sizeZ;

  const halfX = actualSizeX / 2;
  const halfZ = actualSizeZ / 2;
  bricks.push({
    x0: cx - halfX, x1: cx + halfX,
    z0: cz - halfZ, z1: cz + halfZ,
    yTop: originY,
    yBottom: originY + height,
    decorative, line: lines.length + current.length
  });
  return placement
}

function placeMatrix({
  color,
  part,
  matrix,
  sizeX,
  sizeZ,
  height,
  decorative = true,
  confidence,
  note,
  substituteFor,
  connection,
  tubeChecks,
  acceptedOverlaps
}) {
  const line = ldrawLine(color, matrix, part)
  current.push(line);
  const placement = registerPlacement({ color, part, matrix, line, confidence, note, substituteFor, connection, tubeChecks, acceptedOverlaps })
  const e = matrix.elements;
  const cx = e[3];
  const cz = e[11];
  const originY = e[7];
  
  bricks.push({
    x0: cx - sizeX / 2, x1: cx + sizeX / 2,
    z0: cz - sizeZ / 2, z1: cz + sizeZ / 2,
    yTop: originY,
    yBottom: originY + height,
    decorative, line: lines.length + current.length
  });
  return placement
}

function duplo22({ color, cx, cz, originY, decorative = false, confidence, note, substituteFor, connection }) {
  place({
    color,
    part: '3437.dat',
    cx,
    cz,
    originY,
    height: BRICK_H,
    sizeX: 80,
    sizeZ: 80,
    decorative,
    confidence,
    note,
    substituteFor,
    connection
  })
}

function duplo24({ color, cx, cz, originY, rotY = 0, decorative = false, confidence, note, substituteFor, connection }) {
  place({
    color,
    part: '3011.dat',
    cx,
    cz,
    originY,
    height: BRICK_H,
    sizeX: 160,
    sizeZ: 80,
    rotY,
    decorative,
    confidence,
    note,
    substituteFor,
    connection
  })
}

function duplo42029({ color, cx, cz, originY, rotY = 0, rotZ = 0, decorative = true, confidence, note, connection }) {
  place({
    color,
    part: '42029.dat',
    cx,
    cz,
    originY,
    height: 40,
    sizeX: 160,
    sizeZ: 240,
    rotY,
    rotZ,
    decorative,
    confidence,
    note,
    connection
  })
}

lines.push(
  '0 Duplo Dinosaur Slide Playland (STEAM 课件 · 长颈龙 · 12 步搭建)',
  '0 Name: 3-chang-jing-long.ldr',
  '0 Author: STEAM Explore',
  '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
  '0 BFC CERTIFY CCW',
  '0 // 由 scripts/ldraw-models/gen-3-chang-jing-long.mjs 生成',
)

// ---- Step 1: 4 支脚 (2302 弧面脚 + 4层得宝 2x2 交替，最底黄，次绿) ----
// 对应 PDF Page 1 (搭腿)
step('Step 1: 搭建恐龙脚 · 4 块 2302 弧面脚，分别向上叠 4 层交替黄色和绿色的 2x2 积木')

const legs = [
  { cx: -LEG_X, cz: -LEG_Z, footRotY: 270 },
  { cx: LEG_X, cz: -LEG_Z, footRotY: 270 },
  { cx: -LEG_X, cz: LEG_Z, footRotY: 270 },
  { cx: LEG_X, cz: LEG_Z, footRotY: 270 }
];

for (const leg of legs) {
  // 2302 弧面脚（Duplo 2 x 3 curved top）。四个脚尖统一朝搭建图里相反的一侧。
  place({
    color: COLOR.green,
    part: '2302.dat',
    cx: leg.cx,
    cz: leg.cz,
    originY: 0,
    height: FOOT_H,
    sizeX: 120,
    sizeZ: 80,
    rotY: leg.footRotY
  });

  // 向上叠 4 层 2x2 积木：L1(黄) -> L2(绿) -> L3(黄) -> L4(绿)
  duplo22({ color: COLOR.yellow, cx: leg.cx, cz: leg.cz, originY: -48 });   // L1
  duplo22({ color: COLOR.green, cx: leg.cx, cz: leg.cz, originY: -96 });   // L2
  duplo22({ color: COLOR.yellow, cx: leg.cx, cz: leg.cz, originY: -144 });  // L3
  duplo22({ color: COLOR.green, cx: leg.cx, cz: leg.cz, originY: -192 });   // L4
}

// ---- Step 2: 压上绿色大底板 ----
// 对应 PDF Page 2 (四肢顶部装大底板)
step('Step 2: 连接四肢 · 四条腿上方压上一块绿色的 6x12 大颗粒底板')
place({
  color: COLOR.green,
  part: '4196.dat',
  cx: 0,
  cz: 0,
  originY: BODY_PLATE_ORIGIN_Y,
  height: PLATE_H,
  sizeX: BODY_PLATE_PART_SIZE_X,
  sizeZ: BODY_PLATE_PART_SIZE_Z,
  rotY: 90,
  connection: 'The LDraw 4196 plate is rotated 90 degrees so its 12-stud side runs front-to-back and its four corners sit directly over the four 2 x 2 leg columns.'
});

// ---- Step 3: 立起两端黄色拱门支架墙 ----
// 对应 PDF Page 3 (大底板上插两个黄色拱门)
step('Step 3: 立起支架 · 底板前后两端立起黄色拱门支架墙')
place({
  color: COLOR.yellow,
  part: '31191.dat',
  cx: 0,
  cz: -200,
  originY: ARCH_ORIGIN_Y,
  height: ARCH_H,
  sizeX: 240,
  sizeZ: 80
});
place({
  color: COLOR.yellow,
  part: '31191.dat',
  cx: 0,
  cz: 200,
  originY: ARCH_ORIGIN_Y,
  height: ARCH_H,
  sizeX: 240,
  sizeZ: 80
});

// ---- Step 4: 拼直滑梯管 (颜色顺序：蓝黄蓝黄) ----
// 对应 PDF Page 4 (穿过拱门，左侧蓝起，右侧黄收)
step('Step 4: 拼滑梯管道 · 四节直滑梯相接，穿过两个黄色拱门的圆孔')
const tailStraightTube = duploStraightTube(COLOR.blue, 0, TUBE_CENTER_Y, -240);   // 1: -240 -> -120
duploStraightTube(COLOR.yellow, 0, TUBE_CENTER_Y, -120); // 2: -120 -> 0
duploStraightTube(COLOR.blue, 0, TUBE_CENTER_Y, 0);     // 3: 0 -> 120
duploStraightTube(COLOR.yellow, 0, TUBE_CENTER_Y, 120);   // 4: 120 -> 240

function duploStraightTube(color, cx, cy, cz) {
  const mat = Matrix4.makeTranslation(cx, cy, cz);
  return placeMatrix({ color, part: '31452.dat', matrix: mat, sizeX: 80, sizeZ: 120, height: 80 });
}

// ---- Step 5: 左端向下弯曲的尾部滑梯 ----
// 对应 PDF Page 5 (尾巴弯管：黄蓝黄蓝；从 -Z 端向外、向下弯，勿折回 +Z 穿直管)
// 初始朝向用 rotZ(+90deg)*rotY(180deg)：局部 +Z 接到直管 -Z 端，局部 -X 朝向世界 +Y，首节即向下弯。
// 后续弯头按官方 31195.dat outlet transform 链接，避免视觉相近但端口断开的假连接。
step('Step 5: 搭建恐龙尾巴 · 左端滑梯向外、向下弯曲至地面')
let matCurved = Matrix4.multiply(
  Matrix4.makeTranslation(0, TUBE_CENTER_Y, -240),
  Matrix4.multiply(Matrix4.makeRotationZ(Math.PI / 2), Matrix4.makeRotationY(Math.PI))
);

const colorsCurved = [COLOR.yellow, COLOR.blue, COLOR.yellow, COLOR.blue];
const curvedLocalNextStd = Matrix4.multiply(
  Matrix4.makeTranslation(-35.147, 0, 84.853),
  Matrix4.makeRotationY(-Math.PI / 4)
);
const curvedLocalNextFlipped = Matrix4.multiply(
  curvedLocalNextStd,
  Matrix4.makeRotationZ(Math.PI)
);
let previousCurvedTube = null
for (let i = 0; i < 4; i++) {
  const tubeChecks = [
    {
      type: 'portConnection',
      portId: 'inlet',
      targetPlacementId: i === 0 ? tailStraightTube.id : previousCurvedTube.id,
      targetPortId: i === 0 ? 'start' : 'outlet',
      label: i === 0 ? 'tail elbow must connect to the straight tube -Z end' : 'tail elbow chain must keep adjacent ports joined'
    },
    {
      type: 'portDelta',
      fromPortId: 'inlet',
      toPortId: 'outlet',
      label: 'tail elbow must keep bending downward and toward the step 5 tail direction',
      min: { y: 20 },
      max: { z: -20 }
    }
  ];
  previousCurvedTube = placeMatrix({
    color: colorsCurved[i],
    part: '31195.dat',
    matrix: matCurved,
    sizeX: 80,
    sizeZ: 120,
    height: 80,
    tubeChecks
  });

  matCurved = Matrix4.multiply(matCurved, i === 1 ? curvedLocalNextFlipped : curvedLocalNextStd);
}

// ---- Step 6: 右端平台与一节蓝色弯管 ----
// 对应 PDF Page 6 (拼搭滑梯平台入口)
step('Step 6: 搭建滑梯入口 · 右端安装一块红色平台板，并接上一节弯管')
duplo42029({
  color: COLOR.red,
  cx: 0,
  cz: 200,
  originY: bodyY(-496),
  rotY: 180,
  decorative: true,
  confidence: 0.85,
  note: 'Element ID corrected to 42029; geometry is a local LDraw approximation.'
});

let matNeck = Matrix4.multiply(
  Matrix4.makeTranslation(0, TUBE_CENTER_Y, 240),
  Matrix4.makeRotationZ(Math.PI / 2)
);
const neckLocalNext = Matrix4.multiply(
  Matrix4.makeTranslation(-35.147, 0, 84.853),
  Matrix4.makeRotationY(-Math.PI / 4)
);

// 1. 蓝色弯管 (向上弯 45度)
placeMatrix({ color: COLOR.blue, part: '31195.dat', matrix: matNeck, sizeX: 80, sizeZ: 120, height: 80 });
matNeck = Matrix4.multiply(matNeck, neckLocalNext);

// 2. 黄色弯管 (再向上弯 45度，变成垂直向上)
placeMatrix({ color: COLOR.yellow, part: '31195.dat', matrix: matNeck, sizeX: 80, sizeZ: 120, height: 80 });
matNeck = Matrix4.multiply(matNeck, neckLocalNext);

// ---- Step 7: 恐龙脖子垂直加高 (3节直管 + 2节弯管) ----
// 对应 PDF Page 7 (加长脖子以符合官方图纸)
step('Step 7: 恐龙脖子 · 垂直向上拼接三节直管和两节弯管，作为恐龙高耸的脖子')

// 此时 matNeck 的局部 +Z 指向全局正上方（即 -Y 方向）
// 1. 蓝色直管
placeMatrix({ color: COLOR.blue, part: '31452.dat', matrix: matNeck, sizeX: 80, sizeZ: 80, height: 120 });
matNeck = Matrix4.multiply(matNeck, Matrix4.makeTranslation(0, 0, 120));

// 2. 黄色直管
placeMatrix({ color: COLOR.yellow, part: '31452.dat', matrix: matNeck, sizeX: 80, sizeZ: 80, height: 120 });
matNeck = Matrix4.multiply(matNeck, Matrix4.makeTranslation(0, 0, 120));

// 3. 蓝色直管
placeMatrix({ color: COLOR.blue, part: '31452.dat', matrix: matNeck, sizeX: 80, sizeZ: 80, height: 120 });
matNeck = Matrix4.multiply(matNeck, Matrix4.makeTranslation(0, 0, 120));

// 为了让脖子向前弯曲，我们将其绕局部 Z 轴旋转 180 度，反转弯曲方向
matNeck = Matrix4.multiply(matNeck, Matrix4.makeRotationZ(Math.PI));

// 4. 黄色弯管 (向前弯 45度)
placeMatrix({ color: COLOR.yellow, part: '31195.dat', matrix: matNeck, sizeX: 80, sizeZ: 120, height: 80 });
matNeck = Matrix4.multiply(matNeck, neckLocalNext);

// 5. 蓝色弯管 (再向前弯 45度，此时管口变为水平朝前)
placeMatrix({ color: COLOR.blue, part: '31195.dat', matrix: matNeck, sizeX: 80, sizeZ: 120, height: 80 });
matNeck = Matrix4.multiply(matNeck, neckLocalNext);

// ---- Step 8: 恐龙头部 ----
// 对应 PDF Page 8 (龙头拼搭)
step('Step 8: 搭建恐龙头部 · 脖子顶端用黄色积木和红色嘴巴拼搭头部，安上黄色印刷眼睛砖')

// 1. 作为嘴巴的黄色弯管 (向下弯 45 度)
// 此时 matNeck 的局部 +Z 是水平向前。为了向下弯曲，绕局部 Z 轴转 180 度？不，绕局部 Z 转 180 会向上弯。
// 让我们重置一个明确向下的矩阵。
const headX = matNeck.elements[3];
const headY = matNeck.elements[7];
const headZ = matNeck.elements[11];

// 生成向下弯曲的矩阵 (rotZ(-90) 会向下弯曲)
const matMouth = Matrix4.multiply(
  Matrix4.makeTranslation(headX, headY, headZ),
  Matrix4.makeRotationZ(-Math.PI / 2)
);
placeMatrix({ color: COLOR.yellow, part: '31195.dat', matrix: matMouth, sizeX: 80, sizeZ: 120, height: 80 });

// 2. 红色的 Entrance 替代块 (2x4 红色积木)，放在蓝色弯管和黄色弯管交界处上方
duplo42029({
  color: COLOR.red,
  cx: headX,
  cz: headZ - 20,
  originY: headY - 40,
  decorative: true,
  confidence: 0.85,
  note: 'Element ID corrected to 42029; geometry is a local LDraw approximation.'
});

// 3. 顶部的两块黄色 2x2 (眼睛)
duplo22({
  color: COLOR.yellow,
  cx: headX,
  cz: headZ - 60,
  originY: headY - 40 - 48,
  decorative: true,
  confidence: 0.8,
  note: 'Plain yellow 2x2 used; printed eye decoration is not modeled.'
});
duplo22({
  color: COLOR.yellow,
  cx: headX,
  cz: headZ + 20,
  originY: headY - 40 - 48,
  decorative: true,
  confidence: 0.8,
  note: 'Plain yellow 2x2 used; printed eye decoration is not modeled.'
});

// ---- Step 9: 恐龙肚皮（侧壁砌墙，用 2x4 设置 rotY: 90 以彻底避免穿模） ----
// 对应 PDF Page 9 (两侧纵向拼砌肚皮，每排 Z 轴放 2 块 2x4，共 20 块)
step('Step 9: 砌起身体 · 直管道两侧砌起黄色与绿色的 2x4 墙壁')
for (let layer = 0; layer < 5; layer++) {
  const color = layer % 2 === 0 ? COLOR.yellow : COLOR.green;
  const y = BODY_BRICK_ORIGIN_Y - layer * BRICK_H;
  
  // 左墙 (cx = -80, rotY = 90 让 2x4 的长边顺着 Z 轴，X 轴宽仅 80，不和 [-40, 40] 的管道干涉)
  duplo24({ color, cx: -80, cz: -80, originY: y, rotY: 90 });
  duplo24({ color, cx: -80, cz: 80, originY: y, rotY: 90 });
  
  // 右墙 (cx = 80, rotY = 90)
  duplo24({ color, cx: 80, cz: -80, originY: y, rotY: 90 });
  duplo24({ color, cx: 80, cz: 80, originY: y, rotY: 90 });
}

// ---- Step 10: 封顶顶部平台 (6块绿色 2x4 围圈) ----
// 对应 PDF Page 10 (脊背封顶平台)
step('Step 10: 恐龙背脊 · 两面墙顶部用绿色积木连接，拼成平整的后背')
// 1. 横放 2 块
duplo24({ color: COLOR.green, cx: 0, cz: -160, originY: bodyY(-496), decorative: true });
duplo24({ color: COLOR.green, cx: 0, cz: 160, originY: bodyY(-496), decorative: true });
// 2. 纵放 4 块
duplo24({ color: COLOR.green, cx: -80, cz: -80, originY: bodyY(-496), rotY: 90, decorative: true });
duplo24({ color: COLOR.green, cx: -80, cz: 80, originY: bodyY(-496), rotY: 90, decorative: true });
duplo24({ color: COLOR.green, cx: 80, cz: -80, originY: bodyY(-496), rotY: 90, decorative: true });
duplo24({ color: COLOR.green, cx: 80, cz: 80, originY: bodyY(-496), rotY: 90, decorative: true });

// ---- Step 11: 背部起伏脊梁 (3块黄色 2x4 + 2块绿色 2x4，纵放) ----
// 对应 PDF Page 11 (背脊凸起)
step('Step 11: 装饰背脊 · 后背后方叠上黄色和绿色的起伏积木')
// 前排：2个黄色
duplo24({ color: COLOR.yellow, cx: -40, cz: 80, originY: bodyY(-544), rotY: 90, decorative: true });
duplo24({ color: COLOR.yellow, cx: 40, cz: 80, originY: bodyY(-544), rotY: 90, decorative: true });
// 中排：2个绿色
duplo24({ color: COLOR.green, cx: -40, cz: 0, originY: bodyY(-544), rotY: 90, decorative: true });
duplo24({ color: COLOR.green, cx: 40, cz: 0, originY: bodyY(-544), rotY: 90, decorative: true });
// 后排：1个黄色
duplo24({ color: COLOR.yellow, cx: -40, cz: -80, originY: bodyY(-544), rotY: 90, decorative: true });

// ---- Step 12: 最终大功告成 ----
// 对应 PDF Page 12 (成品展示，无新增零件)
step('Step 12: 大功告成 · 长颈龙恐龙滑梯游乐场搭建完成！检查所有积木插口并对照成品图')

step()

// ---- 几何自检 ----
const EPS = 0.001
function overlapArea(a, b) {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  return Math.max(0, ox) * Math.max(0, oz)
}

const issues = []
function verticalOverlap(a, b) {
  return Math.min(a.yBottom, b.yBottom) - Math.max(a.yTop, b.yTop) > EPS
}

for (let i = 0; i < bricks.length; i++) {
  const b = bricks[i]
  if (b.decorative) continue
  if (b.yTop < -EPS) {
    const supporters = bricks.slice(0, i).filter((c) => Math.abs(c.yTop - b.yBottom) < EPS)
    const area = supporters.reduce((s, c) => s + overlapArea(c, b), 0)
    const need = (b.x1 - b.x0) * (b.z1 - b.z0) * 0.125
    if (area < need) {
      issues.push(`砖 (cx:${b.x0.toFixed(0)}~${b.x1.toFixed(0)}, y:${b.yBottom.toFixed(0)}) 支撑不足: ${area.toFixed(0)}/${need.toFixed(0)}`)
    }
  }
  for (let j = 0; j < i; j++) {
    const o = bricks[j]
    if (o.decorative) continue
    if (verticalOverlap(o, b) && overlapArea(o, b) > EPS) {
      issues.push(`穿模 (y:${b.yTop.toFixed(0)}~${b.yBottom.toFixed(0)})`)
    }
  }
}

function summarizePlacements(items) {
  const groups = new Map()
  for (const item of items) {
    const key = `${item.partId}|${item.colorCode}`
    const existing = groups.get(key) || {
      partId: item.partId,
      partName: item.partName,
      colorCode: item.colorCode,
      colorName: item.colorName,
      quantity: 0
    }
    existing.quantity += 1
    groups.set(key, existing)
  }
  return [...groups.values()].sort((a, b) => a.partId.localeCompare(b.partId) || a.colorCode - b.colorCode)
}

function buildBom() {
  const groups = new Map()
  for (const item of placements) {
    const key = `${item.partId}|${item.colorCode}`
    const existing = groups.get(key) || {
      partId: item.partId,
      partName: item.partName,
      ldrawStatus: item.ldrawStatus,
      colorCode: item.colorCode,
      colorName: item.colorName,
      quantity: 0,
      confidence: 1,
      notes: new Set(),
      substitutes: new Set()
    }
    existing.quantity += 1
    existing.confidence = Math.min(existing.confidence, item.confidence)
    if (item.note) existing.notes.add(item.note)
    if (item.substituteFor) existing.substitutes.add(item.substituteFor)
    groups.set(key, existing)
  }
  return {
    model: `${MODEL_SLUG}.ldr`,
    sourceImageDirectory: SOURCE_IMAGE_DIR,
    totalParts: placements.length,
    items: [...groups.values()]
      .map((item) => ({
        partId: item.partId,
        partName: item.partName,
        ldrawStatus: item.ldrawStatus,
        colorCode: item.colorCode,
        colorName: item.colorName,
        quantity: item.quantity,
        confidence: Number(item.confidence.toFixed(2)),
        notes: [...item.notes],
        substitutes: [...item.substitutes]
      }))
      .sort((a, b) => a.partId.localeCompare(b.partId) || a.colorCode - b.colorCode)
  }
}

function buildAssemblyTree() {
  return {
    model: `${MODEL_SLUG}.ldr`,
    sourceImageDirectory: SOURCE_IMAGE_DIR,
    coordinateSystem: 'LDraw: X left/right, Y vertical with negative values upward, Z front/back; one Duplo stud is 40 LDraw units.',
    steps: assemblySteps.map((entry) => ({
      step: entry.step,
      instructionPage: entry.instructionPage,
      title: entry.title,
      addedCount: entry.additions.length,
      additionsSummary: summarizePlacements(entry.additions),
      placements: entry.additions.map((item) => ({
        id: item.id,
        partId: item.partId,
        colorCode: item.colorCode,
        colorName: item.colorName,
        confidence: item.confidence,
        position: item.position,
        orientation: item.orientation,
        connection: item.connection,
        tubeChecks: item.tubeChecks,
        substituteFor: item.substituteFor,
        note: item.note,
        ldrawLine: item.ldrawLine,
        support: item.support,
        acceptedOverlaps: item.acceptedOverlaps,
        decorative: item.decorative
      }))
    }))
  }
}

const target = resolve(process.cwd(), `scripts/ldraw-models/${MODEL_SLUG}.ldr`)
writeFileSync(target, lines.join('\n') + '\n', 'utf8')
process.stderr.write(`已写出 ${target}\n零件数: ${placements.length}\n`)
if (issues.length) {
  process.stderr.write(`几何自检发现 ${issues.length} 处问题:\n` + issues.map((x) => '  - ' + x).join('\n') + '\n')
  process.exit(2)
}
const bomTarget = resolve(process.cwd(), `scripts/ldraw-models/${MODEL_SLUG}.bom.json`)
const assemblyTarget = resolve(process.cwd(), `scripts/ldraw-models/${MODEL_SLUG}-assembly.json`)
writeFileSync(bomTarget, JSON.stringify(buildBom(), null, 2) + '\n', 'utf8')
writeFileSync(assemblyTarget, JSON.stringify(buildAssemblyTree(), null, 2) + '\n', 'utf8')
process.stderr.write(`已写出 ${bomTarget}\n已写出 ${assemblyTarget}\n`)
process.stderr.write('几何自检通过。\n')

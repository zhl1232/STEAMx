#!/usr/bin/env node

/**
 * Generate exact, printable worksheet WebPs from code-generated SVGs for the
 * three fixed math projects.
 *
 * These are deliberately code-generated rather than AI-generated images:
 * coordinates, labels, grid geometry, and answer values must remain exact.
 *
 * Usage:
 *   node scripts/generate-math-worksheet-assets.mjs
 *   node scripts/generate-math-worksheet-assets.mjs --check
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = path.join(ROOT, 'public', 'projects', 'generated')
const WIDTH = 1600
const HEIGHT = 1000
const WEBP_QUALITY = 90
const FONT = "'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif"

const COLORS = {
  ink: '#172033',
  muted: '#526078',
  border: '#d9e2ef',
  grid: '#e8eef6',
  gridStrong: '#c6d3e4',
  paper: '#ffffff',
  canvas: '#f5f8fc',
  blue: '#2563eb',
  blueSoft: '#e8f0ff',
  teal: '#0f766e',
  tealSoft: '#e5f6f3',
  orange: '#c2410c',
  orangeSoft: '#fff0e7',
  purple: '#7c3aed',
  purpleSoft: '#f1eaff',
  green: '#15803d',
  greenSoft: '#e8f7ed',
  red: '#be123c',
  redSoft: '#ffe9ef',
}

const ROCKET_POINTS = [
  { n: 1, x: -2, y: -6, labelDx: -24, labelDy: 24 },
  { n: 2, x: -2, y: 1 },
  { n: 3, x: 0, y: 5 },
  { n: 4, x: 2, y: 1 },
  { n: 5, x: 2, y: -6, labelDx: 16, labelDy: -28 },
  { n: 6, x: -2, y: -6, labelDx: 16, labelDy: -16 },
  { n: 7, x: -2, y: -3 },
  { n: 8, x: -5, y: -5 },
  { n: 9, x: -2, y: -5, labelDx: -22, labelDy: 8 },
  { n: 10, x: 2, y: -3 },
  { n: 11, x: 5, y: -5 },
  { n: 12, x: 2, y: -5, labelDx: 20, labelDy: 20 },
  { n: 13, x: -1, y: -6 },
  { n: 14, x: 0, y: -8 },
  { n: 15, x: 1, y: -6, labelDx: 14, labelDy: 22 },
]

const FISH_POINTS = [
  { n: 1, x: -5, y: 4, labelDx: -18, labelDy: -12 },
  { n: 2, x: -1, y: 8 },
  { n: 3, x: -2, y: 4 },
  { n: 4, x: -1, y: 0 },
  { n: 5, x: -5, y: 4, labelDx: 14, labelDy: 22 },
  { n: 6, x: -1, y: 4, labelDx: -18, labelDy: -12 },
  { n: 7, x: 2, y: 7 },
  { n: 8, x: 7, y: 8 },
  { n: 9, x: 11, y: 6 },
  { n: 10, x: 13, y: 4 },
  { n: 11, x: 11, y: 2 },
  { n: 12, x: 7, y: 0 },
  { n: 13, x: 2, y: 1 },
  { n: 14, x: -1, y: 4, labelDx: 14, labelDy: 22 },
  { n: 15, x: 8, y: 6 },
  { n: 16, x: 9, y: 6 },
  { n: 17, x: 9, y: 5 },
  { n: 18, x: 8, y: 5 },
]

const FISH_GROUPS = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 15],
]

const ROCKET_GROUPS = [
  [1, 2, 3, 4, 5, 6],
  [7, 8, 9, 7],
  [10, 11, 12, 10],
  [13, 14, 15, 13],
]

const MAGIC_3_A = [
  [8, null, 6],
  [null, 5, 7],
  [4, null, 2],
]

const MAGIC_3_A_ANSWER = [
  [8, 1, 6],
  [3, 5, 7],
  [4, 9, 2],
]

const MAGIC_3_B = [
  [null, 1, 6],
  [3, null, 7],
  [4, 9, null],
]

const MAGIC_3_B_ANSWER = [
  [8, 1, 6],
  [3, 5, 7],
  [4, 9, 2],
]

const MAGIC_4 = [
  [16, null, 2, 13],
  [5, 10, null, 8],
  [null, 6, 7, 12],
  [4, null, 14, 1],
]

const MAGIC_4_ANSWER = [
  [16, 3, 2, 13],
  [5, 10, 11, 8],
  [9, 6, 7, 12],
  [4, 15, 14, 1],
]

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function text(x, y, value, options = {}) {
  const {
    size = 24,
    fill = COLORS.ink,
    weight = 500,
    anchor = 'start',
    baseline = 'alphabetic',
    letterSpacing = 0,
    opacity = 1,
    italic = false,
  } = options
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${baseline}" letter-spacing="${letterSpacing}px" opacity="${opacity}"${italic ? ' font-style="italic"' : ''}>${escapeXml(value)}</text>`
}

function multiline(x, y, lines, options = {}) {
  const { lineHeight = 32, ...textOptions } = options
  return lines
    .map((line, index) => text(x, y + index * lineHeight, line, textOptions))
    .join('')
}

function rect(x, y, width, height, options = {}) {
  const {
    fill = 'none',
    stroke = 'none',
    strokeWidth = 1,
    radius = 0,
    opacity = 1,
    dash = '',
  } = options
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function line(x1, y1, x2, y2, options = {}) {
  const {
    stroke = COLORS.border,
    strokeWidth = 1,
    opacity = 1,
    dash = '',
    linecap = 'round',
  } = options
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="${linecap}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function circle(cx, cy, radius, options = {}) {
  const {
    fill = COLORS.paper,
    stroke = COLORS.blue,
    strokeWidth = 2,
    opacity = 1,
  } = options
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`
}

function polyline(points, options = {}) {
  const {
    stroke = COLORS.blue,
    strokeWidth = 4,
    fill = 'none',
    opacity = 1,
    dash = '',
  } = options
  return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function card(x, y, width, height, options = {}) {
  return rect(x, y, width, height, {
    fill: options.fill ?? COLORS.paper,
    stroke: options.stroke ?? COLORS.border,
    strokeWidth: options.strokeWidth ?? 2,
    radius: options.radius ?? 28,
    opacity: options.opacity ?? 1,
  })
}

function sectionLabel(x, y, label, accent = COLORS.blue) {
  return `${rect(x, y - 25, 10, 34, { fill: accent, radius: 5 })}${text(x + 24, y, label, { size: 26, weight: 800 })}`
}

function badge(x, y, label, options = {}) {
  const fill = options.fill ?? COLORS.blueSoft
  const color = options.color ?? COLORS.blue
  const width = options.width ?? Math.max(100, label.length * 25 + 38)
  return `${rect(x, y, width, 42, { fill, radius: 21 })}${text(x + width / 2, y + 22, label, { size: 19, fill: color, weight: 800, anchor: 'middle', baseline: 'middle' })}`
}

function svgDocument({ id, title, subtitle, body, accent = COLORS.blue, footer = 'STEAMX · 史迪姆  ·  固定题面' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="${id}-title ${id}-desc">
  <title id="${id}-title">${escapeXml(title)}</title>
  <desc id="${id}-desc">${escapeXml(subtitle)}</desc>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.canvas}"/>
  ${rect(48, 40, WIDTH - 96, HEIGHT - 80, { fill: COLORS.paper, stroke: COLORS.border, strokeWidth: 2, radius: 36 })}
  ${rect(48, 40, 14, HEIGHT - 80, { fill: accent, radius: 7 })}
  ${text(96, 112, title, { size: 46, weight: 900 })}
  ${text(98, 155, subtitle, { size: 23, fill: COLORS.muted, weight: 500 })}
  ${body}
  ${line(96, 918, 1504, 918, { stroke: COLORS.border, strokeWidth: 2 })}
  ${text(98, 954, footer, { size: 18, fill: COLORS.muted, weight: 600 })}
  ${text(1502, 954, '打印时请选择“实际大小”', { size: 18, fill: COLORS.muted, weight: 600, anchor: 'end' })}
</svg>
`
}

function coordinateGrid({ x, y, width, height, minX, maxX, minY, maxY, points = [], lineGroups = [], accent = COLORS.blue, showLabels = true, labelEvery = 2 }) {
  const xScale = width / (maxX - minX)
  const yScale = height / (maxY - minY)
  const toX = (value) => x + (value - minX) * xScale
  const toY = (value) => y + height - (value - minY) * yScale
  const parts = [rect(x, y, width, height, { fill: '#fbfdff', stroke: COLORS.border, strokeWidth: 2, radius: 18 })]

  for (let value = minX; value <= maxX; value += 1) {
    const px = toX(value)
    parts.push(line(px, y, px, y + height, {
      stroke: value === 0 ? accent : (value % 5 === 0 ? COLORS.gridStrong : COLORS.grid),
      strokeWidth: value === 0 ? 2.5 : (value % 5 === 0 ? 1.5 : 1),
    }))
    if (showLabels && (value % labelEvery === 0 || value === minX || value === maxX)) {
      parts.push(text(px, y + height + 25, value, { size: 15, fill: COLORS.muted, weight: 600, anchor: 'middle' }))
    }
  }

  for (let value = minY; value <= maxY; value += 1) {
    const py = toY(value)
    parts.push(line(x, py, x + width, py, {
      stroke: value === 0 ? accent : (value % 5 === 0 ? COLORS.gridStrong : COLORS.grid),
      strokeWidth: value === 0 ? 2.5 : (value % 5 === 0 ? 1.5 : 1),
    }))
    if (showLabels && (value % labelEvery === 0 || value === minY || value === maxY)) {
      parts.push(text(x - 14, py + 1, value, { size: 15, fill: COLORS.muted, weight: 600, anchor: 'end', baseline: 'middle' }))
    }
  }

  parts.push(text(x + width - 10, toY(0) - 14, 'x', { size: 20, fill: accent, weight: 900, anchor: 'end' }))
  parts.push(text(toX(0) + 14, y + 20, 'y', { size: 20, fill: accent, weight: 900 }))

  const pointMap = new Map(points.map((point) => [point.n, point]))
  for (const group of lineGroups) {
    const mapped = group.map((number) => pointMap.get(number)).filter(Boolean).map((point) => [toX(point.x), toY(point.y)])
    if (mapped.length > 1) parts.push(polyline(mapped, { stroke: accent, strokeWidth: 4 }))
  }

  for (const point of points) {
    const px = toX(point.x)
    const py = toY(point.y)
    parts.push(circle(px, py, point.radius ?? 6, { fill: COLORS.paper, stroke: point.stroke ?? accent, strokeWidth: 2.5 }))
    if (point.n !== undefined) {
      parts.push(text(px + (point.labelDx ?? 8), py + (point.labelDy ?? -10), point.n, { size: point.labelSize ?? 17, fill: point.labelColor ?? COLORS.ink, weight: 800 }))
    }
  }

  return parts.join('')
}

function coordinateList(x, y, items, options = {}) {
  const { columns = 1, columnWidth = 180, lineHeight = 36, size = 21, title = '' } = options
  const parts = []
  if (title) parts.push(text(x, y, title, { size: 23, weight: 800 }))
  const startY = title ? y + 38 : y
  items.forEach((item, index) => {
    const column = Math.floor(index / Math.ceil(items.length / columns))
    const row = index % Math.ceil(items.length / columns)
    parts.push(text(x + column * columnWidth, startY + row * lineHeight, item, { size, fill: COLORS.ink, weight: 650 }))
  })
  return parts.join('')
}

function dotGrid({ x, y, width, height, points, lineGroups = [], title, minX = -7, maxX = 15, minY = -2, maxY = 10, accent = COLORS.teal, answer = false }) {
  const body = [
    coordinateGrid({ x, y, width, height, minX, maxX, minY, maxY, points, lineGroups: answer ? lineGroups : [], accent, labelEvery: 2 }),
  ]
  if (title) body.push(text(x + 18, y + 34, title, { size: 21, fill: accent, weight: 850 }))
  return body.join('')
}

function magicGrid(x, y, size, values, options = {}) {
  const n = values.length
  const cell = size / n
  const accent = options.accent ?? COLORS.purple
  const parts = [rect(x, y, size, size, { fill: COLORS.paper, stroke: accent, strokeWidth: 3, radius: 12 })]
  for (let row = 0; row < n; row += 1) {
    for (let column = 0; column < n; column += 1) {
      const cellX = x + column * cell
      const cellY = y + row * cell
      parts.push(rect(cellX, cellY, cell, cell, {
        fill: values[row][column] === null ? COLORS.purpleSoft : COLORS.paper,
        stroke: accent,
        strokeWidth: 2,
        radius: 0,
      }))
      if (values[row][column] !== null) {
        parts.push(text(cellX + cell / 2, cellY + cell / 2 + 2, values[row][column], { size: Math.max(24, cell * 0.28), fill: COLORS.ink, weight: 850, anchor: 'middle', baseline: 'middle' }))
      } else {
        parts.push(text(cellX + cell / 2, cellY + cell / 2 + 2, '？', { size: Math.max(26, cell * 0.26), fill: accent, weight: 850, anchor: 'middle', baseline: 'middle' }))
      }
    }
  }
  return parts.join('')
}

function checklist(x, y, items, options = {}) {
  const accent = options.accent ?? COLORS.green
  const parts = []
  items.forEach((item, index) => {
    const rowY = y + index * 48
    parts.push(rect(x, rowY - 22, 28, 28, { fill: COLORS.paper, stroke: accent, strokeWidth: 2.5, radius: 7 }))
    parts.push(text(x + 48, rowY, item, { size: 22, weight: 650 }))
  })
  return parts.join('')
}

function rocketPreview(x, y, scale = 1, options = {}) {
  const centerX = x
  const centerY = y
  const map = (point) => [centerX + point.x * 28 * scale, centerY - point.y * 28 * scale]
  const pointMap = new Map(ROCKET_POINTS.map((point) => [point.n, point]))
  const parts = []
  for (const group of ROCKET_GROUPS) {
    const mapped = group.map((number) => map(pointMap.get(number)))
    parts.push(polyline(mapped, { stroke: options.stroke ?? COLORS.blue, strokeWidth: 6 * scale, fill: options.fill ?? 'none' }))
  }
  return parts.join('')
}

function fishPreview(x, y, scale = 1, answer = false) {
  const pointMap = new Map(FISH_POINTS.map((point) => [point.n, point]))
  const map = (point) => [x + point.x * 20 * scale, y - point.y * 20 * scale]
  const parts = []
  if (answer) {
    for (const group of FISH_GROUPS) {
      parts.push(polyline(group.map((number) => map(pointMap.get(number))), { stroke: COLORS.teal, strokeWidth: 5 * scale }))
    }
  }
  for (const point of FISH_POINTS) {
    const [px, py] = map(point)
    parts.push(circle(px, py, 5 * scale, { fill: COLORS.paper, stroke: COLORS.teal, strokeWidth: 2 * scale }))
  }
  return parts.join('')
}

function make0358Cover() {
  const body = [
    card(96, 205, 880, 640, { fill: COLORS.blueSoft, stroke: '#c7d9ff' }),
    coordinateGrid({ x: 132, y: 268, width: 790, height: 470, minX: -10, maxX: 10, minY: -10, maxY: 10, points: ROCKET_POINTS, lineGroups: ROCKET_GROUPS, accent: COLORS.blue, labelEvery: 2 }),
    text(132, 790, '小火箭：坐标描点 → 依次连线 → 平移与翻折', { size: 22, fill: COLORS.blue, weight: 800 }),
    card(1020, 205, 450, 640, { fill: COLORS.paper }),
    badge(1060, 252, '固定题面', { fill: COLORS.blueSoft, color: COLORS.blue, width: 150 }),
    text(1060, 360, '这是一套可以直接', { size: 30, weight: 850 }),
    text(1060, 406, '拿来做的坐标练习。', { size: 30, weight: 850 }),
    checklist(1060, 492, ['坐标纸范围 -10 至 10', '小火箭固定点位', '平移与 x 轴翻折', '最后按标准核对'], { accent: COLORS.blue }),
    text(1060, 760, '不需要自己设计图案', { size: 22, fill: COLORS.muted, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0358-guide', title: '坐标画图固定题面', subtitle: '按固定坐标完成描点、连线、平移和翻折练习。', body, accent: COLORS.blue })
}

function make0358Step1() {
  const body = [
    card(96, 205, 1000, 650, { fill: COLORS.blueSoft, stroke: '#c7d9ff' }),
    coordinateGrid({ x: 145, y: 260, width: 900, height: 520, minX: -10, maxX: 10, minY: -10, maxY: 10, accent: COLORS.blue, labelEvery: 2 }),
    card(1140, 250, 330, 420, { fill: COLORS.paper }),
    sectionLabel(1180, 310, '先完成坐标系', COLORS.blue),
    multiline(1180, 390, ['横轴是 x，纵轴是 y。', '原点写 O。', '两个轴都标到 -10 至 10。', '后面的题都用这张坐标纸。'], { size: 22, lineHeight: 48, fill: COLORS.ink, weight: 650 }),
    badge(1180, 630, '方格纸 + 直尺', { fill: COLORS.blueSoft, color: COLORS.blue, width: 220 }),
  ].join('')
  return svgDocument({ id: 'math-0358-step-1', title: '坐标画图：建立坐标系', subtitle: '先画好一张 -10 至 10 的坐标纸。', body, accent: COLORS.blue })
}

function make0358Step2() {
  const body = [
    card(96, 205, 930, 650, { fill: COLORS.paper }),
    coordinateGrid({ x: 135, y: 265, width: 850, height: 500, minX: -10, maxX: 10, minY: -10, maxY: 10, accent: COLORS.blue, labelEvery: 2 }),
    card(1060, 230, 410, 560, { fill: COLORS.blueSoft, stroke: '#c7d9ff' }),
    sectionLabel(1100, 292, '固定描点题', COLORS.blue),
    multiline(1100, 348, ['在左边坐标系中标出 A—E，', '再按 A → B → C → D → E → A', '依次连线。'], { size: 21, lineHeight: 35, fill: COLORS.ink, weight: 650 }),
    coordinateList(1100, 495, ['A  ( 3,  5 )', 'B  (-2,  4 )', 'C  (-5, -1 )', 'D  ( 4, -3 )', 'E  ( 6,  2 )'], { lineHeight: 42, size: 23 }),
    badge(1100, 720, '完成后闭合图形', { fill: COLORS.paper, color: COLORS.blue, width: 250 }),
  ].join('')
  return svgDocument({ id: 'math-0358-step-2', title: '坐标画图：固定描点题', subtitle: '根据坐标表标出五个点，并按顺序闭合连线。', body, accent: COLORS.blue })
}

function make0358Step3() {
  const body = [
    card(96, 205, 900, 650, { fill: COLORS.blueSoft, stroke: '#c7d9ff' }),
    coordinateGrid({ x: 135, y: 265, width: 820, height: 500, minX: -7, maxX: 7, minY: -10, maxY: 7, accent: COLORS.blue, labelEvery: 2 }),
    card(1030, 220, 440, 590, { fill: COLORS.paper }),
    sectionLabel(1070, 278, '固定题面：小火箭', COLORS.blue),
    multiline(1070, 336, ['把下面的点标在左边坐标系，', '每一组单独连线。'], { size: 21, lineHeight: 34, weight: 650 }),
    coordinateList(1070, 430, ['外框：1(-2,-6)  2(-2,1)', '      3(0,5)    4(2,1)', '      5(2,-6)    6(-2,-6)', '左翼：7(-2,-3)  8(-5,-5)', '      9(-2,-5)  回到 7', '右翼：10(2,-3) 11(5,-5)', '      12(2,-5) 回到 10', '火焰：13(-1,-6) 14(0,-8)', '      15(1,-6)  回到 13'], { lineHeight: 38, size: 18 }),
    badge(1070, 755, '抬笔后再开始下一组', { fill: COLORS.orangeSoft, color: COLORS.orange, width: 280 }),
  ].join('')
  return svgDocument({ id: 'math-0358-step-3', title: '坐标画图：小火箭固定题', subtitle: '固定点位已经给出，只需描点并按组连线。', body, accent: COLORS.blue })
}

function make0358Step4() {
  const body = [
    card(96, 205, 1374, 650, { fill: COLORS.paper }),
    text(136, 255, '在三张坐标纸上画出同一个小火箭：原图、向右平移 4 格、关于 x 轴翻折。', { size: 23, weight: 750 }),
    text(136, 294, '平移： (x,y) → (x+4,y)        翻折： (x,y) → (x,-y)', { size: 21, fill: COLORS.muted, weight: 650 }),
    coordinateGrid({ x: 130, y: 330, width: 390, height: 390, minX: -7, maxX: 9, minY: -10, maxY: 7, accent: COLORS.blue, labelEvery: 4 }),
    coordinateGrid({ x: 585, y: 330, width: 390, height: 390, minX: -7, maxX: 9, minY: -10, maxY: 7, accent: COLORS.orange, labelEvery: 4 }),
    coordinateGrid({ x: 1040, y: 330, width: 390, height: 390, minX: -7, maxX: 9, minY: -10, maxY: 7, accent: COLORS.purple, labelEvery: 4 }),
    text(325, 765, '原图', { size: 23, fill: COLORS.blue, weight: 850, anchor: 'middle' }),
    text(780, 765, '向右平移 4 格', { size: 23, fill: COLORS.orange, weight: 850, anchor: 'middle' }),
    text(1235, 765, '关于 x 轴翻折', { size: 23, fill: COLORS.purple, weight: 850, anchor: 'middle' }),
  ].join('')
  return svgDocument({ id: 'math-0358-step-4', title: '坐标画图：平移与翻折', subtitle: '把同一个固定图案画在三张坐标纸上，比较位置和朝向。', body, accent: COLORS.purple })
}

function make0358Step5() {
  const body = [
    card(96, 205, 760, 640, { fill: COLORS.greenSoft, stroke: '#bde5c9' }),
    sectionLabel(140, 280, '完成检查', COLORS.green),
    checklist(140, 360, ['每个坐标的 x、y 都读对', '每组连线顺序正确', '平移后每个 x 都加 4', '翻折后每个 y 都变号', '原图、平移图、翻折图用不同颜色'], { accent: COLORS.green }),
    badge(140, 690, '全部勾上再提交记录', { fill: COLORS.paper, color: COLORS.green, width: 270 }),
    card(910, 205, 560, 640, { fill: COLORS.paper }),
    text(950, 280, '标准图形参考', { size: 26, weight: 850 }),
    coordinateGrid({ x: 980, y: 335, width: 430, height: 390, minX: -7, maxX: 7, minY: -10, maxY: 7, points: ROCKET_POINTS, lineGroups: ROCKET_GROUPS, accent: COLORS.blue, labelEvery: 4, showLabels: false }),
    text(1195, 780, '小火箭外框、双翼和火焰应分组闭合', { size: 18, fill: COLORS.muted, weight: 600, anchor: 'middle' }),
  ].join('')
  return svgDocument({ id: 'math-0358-step-5', title: '坐标画图：核对标准', subtitle: '完成后按清单检查，确认坐标变换没有漏点。', body, accent: COLORS.green })
}

function make0373Cover() {
  const body = [
    card(96, 205, 850, 640, { fill: COLORS.tealSoft, stroke: '#bde7df' }),
    fishPreview(440, 570, 1.25, true),
    text(440, 790, '小鱼固定点阵：18 个编号点', { size: 22, fill: COLORS.teal, weight: 850, anchor: 'middle' }),
    card(990, 205, 480, 640, { fill: COLORS.paper }),
    badge(1030, 252, '按编号连线', { fill: COLORS.tealSoft, color: COLORS.teal, width: 190 }),
    text(1030, 360, '点位已经准备好，', { size: 30, weight: 850 }),
    text(1030, 406, '不用自己设计轮廓。', { size: 30, weight: 850 }),
    checklist(1030, 492, ['小鱼：18 个编号点', '小火箭：15 个编号点', '按组连线，不要补点', '最后再涂色和镜像'], { accent: COLORS.teal }),
    text(1030, 760, '练习纸上不预先显示答案线', { size: 21, fill: COLORS.muted, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0373-guide', title: '数字连线画固定题面', subtitle: '按编号连接固定点阵，完成小鱼、小火箭和镜像加题。', body, accent: COLORS.teal })
}

function make0373Step1() {
  const body = [
    card(96, 205, 1050, 650, { fill: COLORS.tealSoft, stroke: '#bde7df' }),
    dotGrid({ x: 135, y: 260, width: 970, height: 520, points: FISH_POINTS, lineGroups: FISH_GROUPS, title: '题一：小鱼（只标点，不先连线）', accent: COLORS.teal }),
    card(1190, 245, 280, 500, { fill: COLORS.paper }),
    sectionLabel(1225, 305, '做题步骤', COLORS.teal),
    multiline(1225, 380, ['1. 找到编号 1。', '2. 按 1→2→…→14', '   连成身体。', '3. 抬笔后连接', '   15→16→17→18→15。', '4. 对照小鱼图案。'], { size: 21, lineHeight: 48, weight: 650 }),
    badge(1225, 670, '本题共 18 个点', { fill: COLORS.tealSoft, color: COLORS.teal, width: 210 }),
  ].join('')
  return svgDocument({ id: 'math-0373-step-1', title: '数字连线画：小鱼点阵', subtitle: '按编号连接点阵，身体和眼睛是两组线。', body, accent: COLORS.teal })
}

function make0373Step2() {
  const body = [
    card(96, 205, 900, 650, { fill: COLORS.tealSoft, stroke: '#bde7df' }),
    dotGrid({ x: 135, y: 260, width: 820, height: 520, points: ROCKET_POINTS, lineGroups: ROCKET_GROUPS, minX: -7, maxX: 7, minY: -10, maxY: 7, title: '题二：小火箭（只标点，不先连线）', accent: COLORS.teal }),
    card(1030, 220, 440, 590, { fill: COLORS.paper }),
    sectionLabel(1070, 278, '四组线段', COLORS.teal),
    multiline(1070, 342, ['外框：1→2→3→4→5→6', '左翼：7→8→9→7', '右翼：10→11→12→10', '火焰：13→14→15→13', '', '每组开始前抬笔。'], { size: 22, lineHeight: 53, weight: 650 }),
    badge(1070, 700, '本题共 15 个点', { fill: COLORS.tealSoft, color: COLORS.teal, width: 210 }),
  ].join('')
  return svgDocument({ id: 'math-0373-step-2', title: '数字连线画：小火箭点阵', subtitle: '按四组固定编号连接，不要自行补点或改位置。', body, accent: COLORS.teal })
}

function make0373Step3() {
  const body = [
    card(96, 205, 880, 650, { fill: COLORS.paper }),
    sectionLabel(140, 280, '同伴挑战记录', COLORS.teal),
    multiline(140, 350, ['把题一或题二的练习纸交给同伴。', '同伴只能看编号点，不能先看答案。', '完成后再一起核对图案。'], { size: 24, lineHeight: 48, weight: 650 }),
    text(140, 545, '本次选择：', { size: 22, weight: 800 }),
    rect(300, 516, 30, 30, { fill: COLORS.paper, stroke: COLORS.teal, strokeWidth: 2.5, radius: 7 }),
    text(350, 542, '小鱼', { size: 22, weight: 700 }),
    rect(480, 516, 30, 30, { fill: COLORS.paper, stroke: COLORS.teal, strokeWidth: 2.5, radius: 7 }),
    text(530, 542, '小火箭', { size: 22, weight: 700 }),
    text(140, 625, '同伴姓名：', { size: 22, weight: 700 }),
    line(280, 620, 760, 620, { stroke: COLORS.teal, strokeWidth: 2 }),
    text(140, 700, '是否按顺序完成：', { size: 22, weight: 700 }),
    rect(380, 671, 30, 30, { fill: COLORS.paper, stroke: COLORS.teal, strokeWidth: 2.5, radius: 7 }),
    text(430, 697, '是', { size: 22, weight: 700 }),
    rect(500, 671, 30, 30, { fill: COLORS.paper, stroke: COLORS.teal, strokeWidth: 2.5, radius: 7 }),
    text(550, 697, '需要重画', { size: 22, weight: 700 }),
    card(1030, 205, 440, 650, { fill: COLORS.tealSoft, stroke: '#bde7df' }),
    fishPreview(1240, 480, 1.05, false),
    text(1250, 760, '先做题，再看标准图', { size: 22, fill: COLORS.teal, weight: 850, anchor: 'middle' }),
  ].join('')
  return svgDocument({ id: 'math-0373-step-3', title: '数字连线画：同伴挑战', subtitle: '用固定题面和同伴互相检查编号顺序。', body, accent: COLORS.teal })
}

function make0373Step4() {
  const body = [
    card(96, 205, 1374, 650, { fill: COLORS.tealSoft, stroke: '#bde7df' }),
    sectionLabel(140, 278, '完成后的标准参考', COLORS.teal),
    card(140, 325, 610, 455, { fill: COLORS.paper }),
    fishPreview(440, 560, 1.1, true),
    text(445, 735, '小鱼：身体蓝色，鱼鳍绿色', { size: 21, fill: COLORS.teal, weight: 800, anchor: 'middle' }),
    card(810, 325, 610, 455, { fill: COLORS.paper }),
    coordinateGrid({ x: 860, y: 370, width: 510, height: 330, minX: -7, maxX: 7, minY: -10, maxY: 7, points: ROCKET_POINTS, lineGroups: ROCKET_GROUPS, accent: COLORS.teal, labelEvery: 4, showLabels: false }),
    text(1115, 735, '小火箭：外框红色，火焰橙色', { size: 21, fill: COLORS.teal, weight: 800, anchor: 'middle' }),
    text(140, 825, '如果线条没有闭合，先回到题一或题二检查是否漏连了回到起点的线。', { size: 21, fill: COLORS.muted, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0373-step-4', title: '数字连线画：涂色与核对', subtitle: '完成连线后再涂色，用标准图检查是否闭合。', body, accent: COLORS.teal })
}

function make0373Step5() {
  const mirroredRocket = ROCKET_POINTS.map((point) => ({ ...point, x: -point.x }))
  const body = [
    card(96, 205, 620, 650, { fill: COLORS.paper }),
    sectionLabel(140, 280, '原小火箭', COLORS.teal),
    dotGrid({ x: 140, y: 335, width: 530, height: 380, points: ROCKET_POINTS, lineGroups: ROCKET_GROUPS, minX: -7, maxX: 7, minY: -10, maxY: 7, accent: COLORS.teal }),
    text(405, 780, '记录每个点的 x、y', { size: 21, fill: COLORS.muted, weight: 700, anchor: 'middle' }),
    card(820, 205, 650, 650, { fill: COLORS.orangeSoft, stroke: '#ffd2bc' }),
    sectionLabel(860, 280, '镜像加题', COLORS.orange),
    multiline(860, 340, ['把每个点的 x 改成 -x，', 'y 保持不变，再按同样分组连线。', '', '原：(-2, 1)  →  镜像：(2, 1)', '比较两个图案的左右方向。'], { size: 22, lineHeight: 42, weight: 650 }),
    dotGrid({ x: 860, y: 535, width: 550, height: 240, points: mirroredRocket, lineGroups: ROCKET_GROUPS, minX: -7, maxX: 7, minY: -10, maxY: 7, accent: COLORS.orange }),
  ].join('')
  return svgDocument({ id: 'math-0373-step-5', title: '数字连线画：镜像小火箭', subtitle: '只改变 x 的正负号，观察图案左右翻转。', body, accent: COLORS.orange })
}

function make0381Cover() {
  const body = [
    card(96, 205, 760, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    magicGrid(180, 315, 430, MAGIC_3_A, { accent: COLORS.purple }),
    text(395, 795, '三阶：1—9，幻和 15', { size: 24, fill: COLORS.purple, weight: 850, anchor: 'middle' }),
    card(930, 205, 540, 640, { fill: COLORS.paper }),
    badge(970, 252, '固定填数题', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 190 }),
    text(970, 360, '先算幻和，', { size: 32, weight: 850 }),
    text(970, 408, '再填三阶和四阶。', { size: 32, weight: 850 }),
    checklist(970, 492, ['每个数字只用一次', '每行、每列都相等', '两条对角线也相等', '四阶幻和是 34'], { accent: COLORS.purple }),
    text(970, 760, '所有数字和题面都已固定', { size: 21, fill: COLORS.muted, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0381-guide', title: '幻方填数固定题面', subtitle: '使用固定数字和幻和，完成三阶、四阶幻方练习。', body, accent: COLORS.purple })
}

function make0381Step1() {
  const body = [
    card(96, 205, 760, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    sectionLabel(140, 280, '幻方的三个条件', COLORS.purple),
    checklist(140, 370, ['每行的和相等', '每列的和相等', '两条对角线的和相等', '数字不能重复'], { accent: COLORS.purple }),
    badge(140, 650, '本项目只用连续数字', { fill: COLORS.paper, color: COLORS.purple, width: 260 }),
    card(930, 205, 540, 640, { fill: COLORS.paper }),
    text(970, 280, '数字范围', { size: 26, weight: 850 }),
    magicGrid(990, 340, 190, [[null, null, null], [null, null, null], [null, null, null]], { accent: COLORS.purple }),
    text(1280, 420, '三阶：1—9', { size: 25, fill: COLORS.purple, weight: 850 }),
    text(1280, 470, '幻和：15', { size: 25, fill: COLORS.purple, weight: 850 }),
    magicGrid(990, 565, 190, [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], { accent: COLORS.purple }),
    text(1280, 645, '四阶：1—16', { size: 25, fill: COLORS.purple, weight: 850 }),
    text(1280, 695, '幻和：34', { size: 25, fill: COLORS.purple, weight: 850 }),
  ].join('')
  return svgDocument({ id: 'math-0381-step-1', title: '幻方填数：固定规则', subtitle: '先确认幻方条件和本项目固定使用的数字范围。', body, accent: COLORS.purple })
}

function make0381Step2() {
  const body = [
    card(96, 205, 1374, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    sectionLabel(140, 280, '先算幻和', COLORS.purple),
    card(140, 335, 570, 350, { fill: COLORS.paper }),
    text(185, 415, '三阶', { size: 28, fill: COLORS.purple, weight: 850 }),
    text(185, 480, '1+2+3+…+9 = 45', { size: 28, weight: 800 }),
    text(185, 545, '45 ÷ 3 = 15', { size: 34, fill: COLORS.purple, weight: 900 }),
    text(185, 615, '每行、每列、每条对角线都要等于 15。', { size: 19, fill: COLORS.muted, weight: 650 }),
    card(790, 335, 570, 350, { fill: COLORS.paper }),
    text(835, 415, '四阶', { size: 28, fill: COLORS.purple, weight: 850 }),
    text(835, 480, '1+2+3+…+16 = 136', { size: 28, weight: 800 }),
    text(835, 545, '136 ÷ 4 = 34', { size: 34, fill: COLORS.purple, weight: 900 }),
    text(835, 615, '每行、每列、每条对角线都要等于 34。', { size: 19, fill: COLORS.muted, weight: 650 }),
    badge(140, 750, '把 15 和 34 写在题目旁边', { fill: COLORS.paper, color: COLORS.purple, width: 300 }),
  ].join('')
  return svgDocument({ id: 'math-0381-step-2', title: '幻方填数：计算幻和', subtitle: '使用总和除以阶数，得到每条线必须达到的目标。', body, accent: COLORS.purple })
}

function make0381Step3() {
  const body = [
    card(96, 205, 820, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    sectionLabel(140, 280, '固定题二：三阶补空题 A', COLORS.purple),
    magicGrid(230, 340, 450, MAGIC_3_A, { accent: COLORS.purple }),
    text(455, 820, '使用 1—9，每个数字一次，幻和 15', { size: 22, fill: COLORS.purple, weight: 800, anchor: 'middle' }),
    card(1010, 205, 460, 640, { fill: COLORS.paper }),
    text(1050, 285, '待填数字', { size: 25, weight: 850 }),
    badge(1050, 345, '1', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    badge(1140, 345, '3', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    badge(1230, 345, '9', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    multiline(1050, 490, ['提示：先看每一行缺多少，', '再检查每一列和两条对角线。', '', '完成后八条线都应等于 15。'], { size: 22, lineHeight: 45, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0381-step-3', title: '幻方填数：三阶补空题 A', subtitle: '填入 1、3、9，完成第一道固定三阶题。', body, accent: COLORS.purple })
}

function make0381Step4() {
  const body = [
    card(96, 205, 820, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    sectionLabel(140, 280, '固定题三：三阶补空题 B', COLORS.purple),
    magicGrid(230, 340, 450, MAGIC_3_B, { accent: COLORS.purple }),
    text(455, 820, '使用 1—9，每个数字一次，幻和 15', { size: 22, fill: COLORS.purple, weight: 800, anchor: 'middle' }),
    card(1010, 205, 460, 640, { fill: COLORS.paper }),
    text(1050, 285, '待填数字', { size: 25, weight: 850 }),
    badge(1050, 345, '2', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    badge(1140, 345, '5', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    badge(1230, 345, '8', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 70 }),
    multiline(1050, 490, ['填好后检查行、列、', '左上到右下、右上到左下', '两条对角线。', '', '再用数字卡片复现。'], { size: 22, lineHeight: 42, weight: 650 }),
  ].join('')
  return svgDocument({ id: 'math-0381-step-4', title: '幻方填数：三阶补空题 B', subtitle: '完成第二道三阶固定题，并用数字卡片复现。', body, accent: COLORS.purple })
}

function make0381Step5() {
  const body = [
    card(96, 205, 930, 640, { fill: COLORS.purpleSoft, stroke: '#dac8ff' }),
    sectionLabel(140, 280, '固定题四：四阶补空题', COLORS.purple),
    magicGrid(200, 340, 450, MAGIC_4, { accent: COLORS.purple }),
    text(425, 820, '待填：3、11、9、15   ·   幻和 34', { size: 22, fill: COLORS.purple, weight: 800, anchor: 'middle' }),
    card(1090, 205, 380, 640, { fill: COLORS.paper }),
    text(1130, 285, '最终核对', { size: 25, weight: 850 }),
    checklist(1130, 360, ['1—16 不重复', '四行都为 34', '四列都为 34', '两条对角线为 34'], { accent: COLORS.purple }),
    badge(1130, 670, '完成四阶挑战', { fill: COLORS.purpleSoft, color: COLORS.purple, width: 220 }),
  ].join('')
  return svgDocument({ id: 'math-0381-step-5', title: '幻方填数：四阶补空题', subtitle: '填入 3、11、9、15，完成最后一题并逐条核对。', body, accent: COLORS.purple })
}

const ASSETS = {
  'project-0358-guide.webp': make0358Cover,
  'project-0358-step-1.webp': make0358Step1,
  'project-0358-step-2.webp': make0358Step2,
  'project-0358-step-3.webp': make0358Step3,
  'project-0358-step-4.webp': make0358Step4,
  'project-0358-step-5.webp': make0358Step5,
  'project-0373-guide.webp': make0373Cover,
  'project-0373-step-1.webp': make0373Step1,
  'project-0373-step-2.webp': make0373Step2,
  'project-0373-step-3.webp': make0373Step3,
  'project-0373-step-4.webp': make0373Step4,
  'project-0373-step-5.webp': make0373Step5,
  'project-0381-guide.webp': make0381Cover,
  'project-0381-step-1.webp': make0381Step1,
  'project-0381-step-2.webp': make0381Step2,
  'project-0381-step-3.webp': make0381Step3,
  'project-0381-step-4.webp': make0381Step4,
  'project-0381-step-5.webp': make0381Step5,
}

function flattenValues(matrix) {
  return matrix.flat().filter((value) => value !== null)
}

function assertMagicSquare(matrix, expectedSum) {
  const size = matrix.length
  const values = flattenValues(matrix)
  if (values.length !== size * size || new Set(values).size !== values.length) return false
  const lines = []
  lines.push(...matrix)
  lines.push(...Array.from({ length: size }, (_, column) => matrix.map((row) => row[column])))
  lines.push(matrix.map((row, index) => row[index]))
  lines.push(matrix.map((row, index) => row[size - 1 - index]))
  return lines.every((lineValues) => lineValues.reduce((sum, value) => sum + value, 0) === expectedSum)
}

function assertWorksheetData() {
  if (FISH_POINTS.length !== 18) throw new Error(`Fish point count mismatch: ${FISH_POINTS.length}`)
  if (ROCKET_POINTS.length !== 15) throw new Error(`Rocket point count mismatch: ${ROCKET_POINTS.length}`)
  if (new Set(FISH_POINTS.map((point) => point.n)).size !== 18) throw new Error('Fish labels must be unique')
  if (new Set(ROCKET_POINTS.map((point) => point.n)).size !== 15) throw new Error('Rocket labels must be unique')
  if (!assertMagicSquare(MAGIC_3_A_ANSWER, 15)) throw new Error('3x3 answer A is invalid')
  if (!assertMagicSquare(MAGIC_3_B_ANSWER, 15)) throw new Error('3x3 answer B is invalid')
  if (!assertMagicSquare(MAGIC_4_ANSWER, 34)) throw new Error('4x4 answer is invalid')
  if (flattenValues(MAGIC_3_A).length !== 6) throw new Error('3x3 question A should contain 3 blanks')
  if (flattenValues(MAGIC_3_B).length !== 6) throw new Error('3x3 question B should contain 3 blanks')
  if (flattenValues(MAGIC_4).length !== 12) throw new Error('4x4 question should contain 4 blanks')
}

async function main() {
  assertWorksheetData()
  if (process.argv.includes('--check')) {
    console.log(`Worksheet data passed: ${Object.keys(ASSETS).length} WebP assets defined.`)
    return
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  for (const [filename, build] of Object.entries(ASSETS)) {
    const outputPath = path.join(OUTPUT_DIR, filename)
    const svg = build()
    await sharp(Buffer.from(svg)).webp({ quality: WEBP_QUALITY }).toFile(outputPath)
    console.log(`wrote ${path.relative(ROOT, outputPath)}`)
  }
  console.log(`Generated ${Object.keys(ASSETS).length} exact math worksheet WebPs.`)
}

await main()

import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-lun-chuan.ldr'
const lines = [
  '0 3+ 轮船 (Ship) - renderer-reviewed source reconstruction',
  '0 Name: 3-lun-chuan.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+轮船搭建说明-1.jpg through -11.jpg.',
  '0 // Source window units are represented by official 61649.dat frames plus 90265.dat panes.',
]

const H = '1 0 0 0 1 0 0 0 1'
const V = '0 0 1 0 1 0 -1 0 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

// Tile a one-cell-thick perimeter on a 2x2-stud cell grid with 2x4 bricks.
function ring(color, y, lengthCells) {
  const widthCells = 4
  const xOf = (cell) => (cell - (lengthCells - 1) / 2) * 80
  const zOf = (cell) => (cell - (widthCells - 1) / 2) * 80
  const cells = []
  for (let x = 0; x < lengthCells; x++) cells.push([x, 0])
  for (let z = 1; z < widthCells; z++) cells.push([lengthCells - 1, z])
  for (let x = lengthCells - 2; x >= 0; x--) cells.push([x, widthCells - 1])
  for (let z = widthCells - 2; z >= 1; z--) cells.push([0, z])
  for (let i = 0; i < cells.length; i += 2) {
    const a = cells[i]
    const b = cells[i + 1]
    add(color, (xOf(a[0]) + xOf(b[0])) / 2, y, (zOf(a[1]) + zOf(b[1])) / 2, '3011.dat', a[0] === b[0] ? V : H)
  }
}

function windowUnit(x, y, z) {
  add(4, x, y, z, '61649.dat')
  add(15, x, y, z + Math.sign(z) * 60, '90265.dat')
}

step(1, 'green 8x16 keel plate and fourteen blue hull bricks')
add(2, 0, -24, 0, '6490.dat')
ring(1, -72, 12)

step(2, 'sixteen yellow hull bricks')
ring(14, -120, 14)

step(3, 'eighteen blue hull bricks')
ring(1, -168, 16)

step(4, 'twenty yellow hull bricks')
ring(14, -216, 18)

step(5, 'two green 8x16 main-deck plates')
add(2, -320, -240, 0, '6490.dat')
add(2, 320, -240, 0, '6490.dat')

step(6, 'six red and white lower-cabin window units')
for (const x of [-160, 0, 160]) {
  windowUnit(x, -384, -80)
  windowUnit(x, -384, 80)
}

step(7, 'green 8x16 lower-cabin roof')
add(2, 0, -408, 0, '6490.dat')

step(8, 'four upper-cabin window units and red roof')
for (const x of [-80, 80]) {
  windowUnit(x, -552, -80)
  windowUnit(x, -552, 80)
}
add(4, 0, -576, 0, '6490.dat')

step(9, 'five stern-deck striped fences')
for (const x of [360, 600]) {
  add(15, x, -336, -140, '31021p01.dat')
  add(15, x, -336, 140, '31021p01.dat', '-1 0 0 0 1 0 0 0 -1')
}
add(15, 700, -336, 0, '31021p01.dat', V)

step(10, 'three bow-deck striped fences')
add(15, -600, -336, -140, '31021p01.dat')
add(15, -600, -336, 140, '31021p01.dat', '-1 0 0 0 1 0 0 0 -1')
add(15, -700, -336, 0, '31021p01.dat', V)

step(11, 'finished model, no additions')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-liang-ting.ldr'
const lines = [
  '0 3+ 凉亭 (Pavilion) - renderer-reviewed source reconstruction',
  '0 Name: 3-liang-ting.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+凉亭搭建说明-1.jpg through -17.jpg.',
  '0 // Coordinates: +Y points down; baseplate centered at origin.',
]

const H = '1 0 0 0 1 0 0 0 1'
const V = '0 0 1 0 1 0 1 0 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

// Pair consecutive 2x2-stud cells around one perimeter cycle. This avoids
// double-occupying the four corner cells.
function ring(color, y, outer = 9, part = '3011.dat') {
  const coord = (index) => (index - (outer - 1) / 2) * 80
  const cells = []
  for (let x = 0; x < outer; x++) cells.push([x, 0])
  for (let z = 1; z < outer; z++) cells.push([outer - 1, z])
  for (let x = outer - 2; x >= 0; x--) cells.push([x, outer - 1])
  for (let z = outer - 2; z >= 1; z--) cells.push([0, z])
  for (let i = 0; i < cells.length; i += 2) {
    const a = cells[i]
    const b = cells[(i + 1) % cells.length]
    const x = (coord(a[0]) + coord(b[0])) / 2
    const z = (coord(a[1]) + coord(b[1])) / 2
    add(color, x, y, z, part, a[0] === b[0] ? V : H)
  }
}

function fences(y, edge = 320, offset = 160) {
  for (const x of [-offset, offset]) {
    add(15, x, y, -edge, '31021p01.dat')
    add(15, x, y, edge, '31021p01.dat')
  }
  for (const z of [-offset, offset]) {
    add(15, -edge, y, z, '31021p01.dat', V)
    add(15, edge, y, z, '31021p01.dat', V)
  }
}

function towers(color) {
  for (const cx of [-160, 160]) for (const cz of [-160, 160]) {
    for (let layer = 0; layer < 8; layer++) {
      const y = -168 - layer * 48
      if (layer % 2 === 0) {
        add(color, cx, y, cz - 40, '3011.dat')
        add(color, cx, y, cz + 40, '3011.dat')
      } else {
        add(color, cx - 40, y, cz, '3011.dat', V)
        add(color, cx + 40, y, cz, '3011.dat', V)
      }
    }
  }
}

function roofRing(color, y, edge, positions) {
  for (const x of positions) {
    add(color, x, y, -edge, '3011.dat')
    add(color, x, y, edge, '3011.dat')
  }
  for (const z of positions) {
    add(color, -edge, y, z, '3011.dat', V)
    add(color, edge, y, z, '3011.dat', V)
  }
}

step(1, 'green baseplate and yellow 18x18 perimeter')
add(2, 0, -24, 0, '4268.dat')
ring(14, -72)

step(2, 'eight red-white perimeter fences')
fences(-168)

step(3, 'four red center bricks and two yellow arches')
for (const [x, z] of [[-120, -120], [120, -120], [-120, 120], [120, 120]]) add(4, x, -120, z, '3437.dat')
add(14, -80, -168, 0, '11198.dat')
add(14, 80, -168, 0, '11198.dat')

step(4, 'four blue corner tower pairs')
towers(1)

step(5, 'two green upper floor plates')
add(2, 0, -528, -160, '6490.dat')
add(2, 0, -528, 160, '6490.dat')

step(6, 'yellow upper 16x16 perimeter')
for (const x of [-160, 0, 160]) {
  add(14, x, -576, -280, '3011.dat')
  add(14, x, -576, 280, '3011.dat')
}
for (const z of [-160, 0, 160]) {
  add(14, -280, -576, z, '3011.dat', V)
  add(14, 280, -576, z, '3011.dat', V)
}

step(7, 'eight upper red-white fences')
fences(-672, 280, 140)

step(8, 'two red upper arches')
add(4, -80, -576, -80, '3437.dat')
add(4, 80, -576, 80, '3437.dat')
add(14, 0, -624, 0, '11198.dat')

step(9, 'red four-pillar roof supports')
for (const x of [-160, 160]) for (const z of [-160, 160]) {
  for (let i = 0; i < 7; i++) add(4, x, -576 - i * 48, z, '3437.dat')
}

step(10, 'two green roof plates')
add(2, 0, -888, -160, '6490.dat')
add(2, 0, -888, 160, '6490.dat')

step(11, 'red roof ring')
for (const x of [-160, 0, 160]) {
  add(4, x, -936, -240, '3011.dat')
  add(4, x, -936, 240, '3011.dat')
}
for (const z of [-120, 120]) {
  add(4, -240, -936, z, '3011.dat', V)
  add(4, 240, -936, z, '3011.dat', V)
}

step(12, 'red roof ring')
for (const x of [-80, 80]) {
  add(4, x, -984, -200, '3011.dat')
  add(4, x, -984, 200, '3011.dat')
}
for (const z of [-80, 80]) {
  add(4, -200, -984, z, '3011.dat', V)
  add(4, 200, -984, z, '3011.dat', V)
}

step(13, 'yellow cap and red roof ring')
for (const x of [-80, 80]) {
  add(4, x, -1032, -120, '3011.dat')
  add(4, x, -1032, 120, '3011.dat')
}
add(4, -120, -1032, 0, '3011.dat', V)
add(4, 120, -1032, 0, '3011.dat', V)
add(14, 0, -1080, 0, '3437.dat')

step(14, 'four red cap bricks')
add(4, 0, -1080, -120, '3011.dat')
add(4, 0, -1080, 120, '3011.dat')
add(4, -120, -1080, 0, '3011.dat', V)
add(4, 120, -1080, 0, '3011.dat', V)

step(15, 'red ridge')
add(4, 0, -1128, -40, '3011.dat')
add(4, 0, -1128, 40, '3011.dat')
add(4, 0, -1176, 0, '3437.dat')

step(16, 'yellow stepped roof crown')
for (const x of [-160, -80, 0, 80, 160]) for (const z of [-160, -80, 0, 80, 160]) {
  const distance = (Math.abs(x) + Math.abs(z)) / 80
  add(14, x, -1272 + distance * 48, z, '3437.dat')
}

step(17, 'finished model, no additions')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

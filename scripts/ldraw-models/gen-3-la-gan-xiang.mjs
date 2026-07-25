import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-la-gan-xiang.ldr'
const lines = [
  '0 3+ 拉杆箱 (Rolling Suitcase) - source-reviewed reconstruction',
  '0 Name: 3-la-gan-xiang.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: C:/Users/arron/Downloads/pdf预览/3+拉杆箱搭建说明_pdf, pages 1-11.',
  '0 // Coordinates: +X suitcase width, +Y down, +Z rearward; front studs face -Z.',
  '0 // Side-built sandwich depths follow real 24/48/72 LDU part thicknesses.',
]

const H = '1 0 0 0 0 -1 0 1 0'
const V = '0 0 -1 -1 0 0 0 1 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

function panel(depth) {
  add(2, 0, -160, depth, '6490.dat')
  add(2, 0, 160, depth, '6490.dat')
}

function frame(color, depth) {
  for (const x of [-240, -80, 80, 240]) {
    add(color, x, -280, depth, '3011.dat')
    add(color, x, 280, depth, '3011.dat')
  }
  for (const y of [-160, 0, 160]) {
    add(color, -280, y, depth, '3011.dat', V)
    add(color, 280, y, depth, '3011.dat', V)
  }
}

step(1, 'rear green panels and two yellow-wheel vehicle bases')
panel(72)
add(4, -280, 0, 120, '10715p02.dat')
add(4, 280, 0, 120, '10715p02.dat')

step(2, 'first yellow 16x16 perimeter frame')
frame(14, 0)

step(3, 'first blue perimeter frame')
frame(1, -48)

step(4, 'second yellow frame and two handle anchor tabs')
frame(14, -96)
add(14, -160, -400, -96, '3437.dat')
add(14, 160, -400, -96, '3437.dat')

step(5, 'second blue perimeter frame')
frame(1, -144)

step(6, 'front yellow perimeter frame')
frame(14, -192)

step(7, 'front green panels')
panel(-216)

step(8, 'inner telescoping handle posts')
for (const x of [-160, 160]) {
  add(1, x, -400, -264, '3011.dat', V)
  add(1, x, -400, -360, '3011.dat', V)
  add(14, x, -400, -312, '3011.dat', V)
}

step(9, 'outer blue handle frame and yellow inner U')
for (const x of [-160, 160]) {
  add(1, x, -560, -264, '3011.dat', V)
  add(1, x, -560, -360, '3011.dat', V)
  add(1, x, -720, -360, '3011.dat', V)
  add(14, x, -560, -312, '3011.dat', V)
}
add(1, -80, -840, -360, '3011.dat')
add(1, 80, -840, -360, '3011.dat')
add(14, 0, -680, -312, '3011.dat')

step(10, 'red 28-brick heart on the front face')
const rows = [
  [-280, [-160, 160]],
  [-200, [-160, -80, 0, 80, 160]],
  [-120, [-200, -120, -40, 40, 120, 200]],
  [-40, [-160, -80, 0, 80, 160]],
  [40, [-120, -40, 40, 120]],
  [120, [-80, 0, 80]],
  [200, [-40, 40]],
  [280, [0]],
]
for (const [y, xs] of rows) for (const x of xs) add(4, x, y, -264, '3437.dat')

step(11, 'finished model, no additional parts')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

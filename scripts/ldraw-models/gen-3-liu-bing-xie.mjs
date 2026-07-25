import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-liu-bing-xie.ldr'
const lines = [
  '0 3+ 溜冰鞋 (Roller Skates) - renderer-reviewed source reconstruction',
  '0 Name: 3-liu-bing-xie.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+溜冰鞋搭建说明-1.jpg through -13.jpg.',
  '0 // Each shoe is a 16x8-stud deck; the second shoe is added in step 12.',
]

const H = '1 0 0 0 1 0 0 0 1'
const V = '0 0 1 0 1 0 1 0 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

const xs = [-240, -80, 80, 240]
function perimeter(color, y, z = 0) {
  for (const x of xs) {
    add(color, x, y, z - 120, '3011.dat')
    add(color, x, y, z + 120, '3011.dat')
  }
  add(color, -280, y, z, '3011.dat', V)
  add(color, 280, y, z, '3011.dat', V)
}

function shoe(offsetZ, includeBase = true) {
  if (includeBase) {
    for (const x of xs) add(4, x, -48, offsetZ, '41989.dat')
    add(2, 0, -72, offsetZ, '6490.dat')
  }
  perimeter(1, -120, offsetZ)
  perimeter(14, -168, offsetZ)
  perimeter(1, -216, offsetZ)
  perimeter(14, -264, offsetZ)

  add(7, 160, -288, offsetZ, '51262.dat')
  for (const x of [-240, -80]) {
    add(1, x, -312, offsetZ - 120, '3011.dat')
    add(1, x, -312, offsetZ + 120, '3011.dat')
  }
  add(1, -280, -312, offsetZ, '3011.dat', V)

  for (const x of [40, 120, 200, 280]) add(4, x, -336, offsetZ + 120, '98223b.dat', V)
  for (const x of [40, 120, 200, 280]) add(14, x, -336, offsetZ - 120, '3011.dat', V)

  for (const x of [-240, -80]) {
    add(14, x, -360, offsetZ - 120, '3011.dat')
    add(14, x, -360, offsetZ + 120, '3011.dat')
  }
  add(14, -280, -360, offsetZ, '3011.dat', V)
  for (const x of [-240, -80]) {
    add(14, x, -408, offsetZ - 120, '3011.dat')
    add(14, x, -408, offsetZ + 120, '3011.dat')
  }
  add(14, -280, -408, offsetZ - 40, '3437.dat')
  add(14, -280, -408, offsetZ + 40, '3437.dat')

  add(1, -240, -504, offsetZ - 80, '4198.dat')
  add(1, -80, -504, offsetZ - 80, '4198.dat')
  add(4, 40, -384, offsetZ - 120, '6510.dat')
  add(14, 160, -384, offsetZ - 120, '6510.dat')
  add(10, 280, -384, offsetZ - 120, '6510.dat')
}

step(1, 'four red wheel bases and green deck')
for (const x of xs) add(4, x, -48, 0, '41989.dat')
add(2, 0, -72, 0, '6490.dat')
step(2, 'first blue perimeter')
perimeter(1, -120)
step(3, 'first yellow perimeter')
perimeter(14, -168)
step(4, 'second blue perimeter')
perimeter(1, -216)
step(5, 'second yellow perimeter')
perimeter(14, -264)
step(6, 'gray rear plate')
add(7, 160, -288, 0, '51262.dat')
step(7, 'blue upper deck')
for (const x of [-240, -80]) {
  add(1, x, -312, -120, '3011.dat')
  add(1, x, -312, 120, '3011.dat')
}
add(1, -280, -312, 0, '3011.dat', V)
step(8, 'red rounded toe and yellow front deck')
for (const x of [40, 120, 200, 280]) add(4, x, -336, 120, '98223b.dat', V)
for (const x of [40, 120, 200, 280]) add(14, x, -336, -120, '3011.dat', V)
step(9, 'yellow rear wall and side')
for (const x of [-240, -80]) {
  add(14, x, -360, -120, '3011.dat')
  add(14, x, -360, 120, '3011.dat')
}
add(14, -280, -360, 0, '3011.dat', V)
for (const x of [-240, -80]) {
  add(14, x, -408, -120, '3011.dat')
  add(14, x, -408, 120, '3011.dat')
}
add(14, -280, -408, -40, '3437.dat')
add(14, -280, -408, 40, '3437.dat')
step(10, 'two blue rounded cuff bricks')
add(1, -240, -504, -80, '4198.dat')
add(1, -80, -504, -80, '4198.dat')
step(11, 'three flower decorations')
add(4, 40, -384, -120, '6510.dat')
add(14, 160, -384, -120, '6510.dat')
add(10, 280, -384, -120, '6510.dat')

step(12, 'second complete shoe')
shoe(480)
step(13, 'finished model, no additions')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

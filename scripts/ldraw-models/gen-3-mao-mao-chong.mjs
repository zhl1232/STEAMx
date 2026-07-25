import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-mao-mao-chong.ldr'
const lines = [
  '0 3+ 毛毛虫 (Caterpillar) - renderer-reviewed source reconstruction',
  '0 Name: 3-mao-mao-chong.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+毛毛虫搭建说明-1.jpg through -8.jpg.',
  '0 // The source head/window unit is represented by official 61649.dat and 90265.dat parts.',
]

const H = '1 0 0 0 1 0 0 0 1'
const E = '0 0 1 0 1 0 -1 0 0'
const S = '-1 0 0 0 1 0 0 0 -1'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }
const unit = (color, x, y) => add(color, x, y, 0, '3011.dat', E)

step(1, 'green 24x24 garden base and three bright-green 4x8 plates')
add(2, 0, -24, 0, '4268.dat')
for (const x of [-320, 0, 320]) add(27, x, -48, 0, '10199.dat')

step(2, 'first body layer and red head frame')
unit(1, -400, -96)
for (const x of [-320, -240]) unit(14, x, -96)
for (const x of [-160, -80]) unit(25, x, -96)
for (const x of [0, 80]) unit(2, x, -96)
for (const x of [160, 240]) unit(3, x, -96)
add(4, 440, -192, 0, '61649.dat', E)
add(3, 500, -192, 0, '90265.dat', E)

step(3, 'second staggered body layer')
for (const x of [-440, -360]) unit(1, x, -144)
for (const x of [-280, -200]) unit(14, x, -144)
for (const x of [-120, -40, 40]) unit(25, x, -144)
for (const x of [120, 200]) unit(2, x, -144)
for (const x of [280, 360]) unit(3, x, -144)

step(4, 'third staggered body layer')
for (const x of [-520, -440, -360]) unit(1, x, -192)
for (const x of [-280, -200]) unit(14, x, -192)
for (const x of [-120, -40, 40]) unit(25, x, -192)
for (const x of [120, 200]) unit(2, x, -192)
for (const x of [280, 360]) unit(3, x, -192)

step(5, 'raised back, body humps and two eye bricks')
unit(1, -400, -240)
for (const x of [-240, -160]) unit(14, x, -240)
for (const x of [-80, 0]) unit(25, x, -240)
for (const x of [160, 240, 320]) unit(3, x, -240)
add(14, 440, -240, -40, '3437pe1.dat', E)
add(14, 440, -240, 40, '3437pe1.dat', E)

step(6, 'two plain-yellow fences on the head')
add(14, 560, -336, 40, '31021.dat')
add(14, 440, -336, -100, '31021.dat', E)

step(7, 'nine flowers around and on the caterpillar')
const groundFlowers = [
  [27, -360, -72, -300], [27, 360, -72, 300],
  [25, -80, -72, 320],
  [4, -240, -72, 280], [4, 80, -72, 300],
  [14, -400, -72, 280],
  [3, -80, -72, -300], [3, 240, -72, -300],
]
for (const [color, x, y, z] of groundFlowers) add(color, x, y, z, '6510.dat')
add(25, 0, -288, -20, '6510.dat', S)

step(8, 'finished model, no additions')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

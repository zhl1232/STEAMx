import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-ma-che.ldr'
const lines = [
  '0 3+ 马车 (Horse Carriage) - renderer-reviewed source reconstruction',
  '0 Name: 3-ma-che.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+马车搭建说明-1.jpg through -10.jpg.',
  '0 // Source window units are represented by official 61649.dat frames plus 90265.dat panes.',
]

const H = '1 0 0 0 1 0 0 0 1'
const E = '0 0 1 0 1 0 -1 0 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

function animal(z) {
  add(14, -600, -48, z, '3437.dat')
  add(14, -440, -48, z, '3437.dat')
  add(14, -520, -96, z, '3011.dat')
  add(2, -520, -144, z, '3437.dat')
  add(4, -560, -192, z, '3011.dat')
  add(14, -480, -240, z, '3437pe1.dat')
}

function carriageRing(color, y) {
  for (const z of [-120, 120]) {
    for (const x of [-160, 0, 160]) add(color, x, y, z, '3011.dat')
  }
  add(color, 280, y, 0, '3011.dat', E)
}

function windowUnit(x, z) {
  add(4, x, -264, z, '61649.dat')
  add(15, x, -264, z + Math.sign(z) * 60, '90265.dat')
}

step(1, 'two brick-built animal columns')
animal(-120)
animal(120)

step(2, 'four wheeled bases and green 8x16 plate')
for (const x of [-160, 160]) for (const z of [-80, 80]) add(4, x, -48, z, '10715p02.dat', E)
add(2, 0, -72, 0, '6490.dat')

step(3, 'two black hinged drawbars and yellow round doorway')
add(0, -320, -96, -120, '16686.dat', E)
add(0, -320, -96, 120, '16686.dat', E)
add(14, -280, -312, 0, '31191.dat', E)

step(4, 'seven red lower-wall bricks')
carriageRing(4, -120)

step(5, 'four red and white window units')
for (const x of [-120, 120]) for (const z of [-120, 120]) windowUnit(x, z)

step(6, 'red window surrounds and upper wall')
// Four two-layer corner piers fill the gaps beside the 4-stud window units.
for (const y of [-168, -216]) for (const z of [-120, 120]) {
  add(4, -240, y, z, '3437.dat')
  add(4, 240, y, z, '3437.dat')
}
for (const x of [-160, 0]) add(4, x, -312, -120, '3011.dat')
for (const x of [-160, 0]) add(4, x, -312, 120, '3011.dat')
add(4, 280, -312, 0, '3011.dat', E)

step(7, 'seven red top-wall bricks')
carriageRing(4, -360)

step(8, 'yellow roof rim')
for (const z of [-120, 120]) for (const x of [-160, 0, 160]) add(14, x, -408, z, '3011.dat')
add(14, 280, -408, 0, '3011.dat', E)
add(14, -280, -408, -120, '3437.dat')
add(14, -280, -408, 120, '3437.dat')

step(9, 'seven yellow bricks close the roof')
for (const x of [-240, -160, -80, 0, 80, 160, 240]) add(14, x, -456, 0, '3011.dat', E)

step(10, 'finished model, no additions')
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

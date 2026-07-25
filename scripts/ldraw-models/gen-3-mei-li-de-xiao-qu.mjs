import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-mei-li-de-xiao-qu.ldr'
const lines = [
  '0 3+ 美丽的小区 (Neighborhood) - renderer-reviewed source reconstruction',
  '0 Name: 3-mei-li-de-xiao-qu.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: 3+美丽的小区搭建说明-1.jpg through -30.jpg.',
  '0 // Door/window units use official 61649.dat frames and 90265.dat panes.',
  '0 // Step 24 uses eight bare 61649.dat frames as the source-shown canopy columns.',
]

const H = '1 0 0 0 1 0 0 0 1'
const E = '0 0 1 0 1 0 -1 0 0'
const S = '-1 0 0 0 1 0 0 0 -1'
const W = '0 0 -1 0 1 0 1 0 0'
const add = (color, x, y, z, part, matrix = H) => lines.push(`1 ${color} ${x} ${y} ${z} ${matrix} ${part}`)
const step = (n, title) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${title}`) }

const houseLayer = (cx, y) => {
  for (const x of [-240, -80, 80, 240]) {
    add(14, cx + x, y, -280, '3011.dat')
    add(14, cx + x, y, 280, '3011.dat')
  }
  for (const z of [-240, -80, 80, 240]) {
    add(14, cx - 360, y, z, '3011.dat', E)
    add(14, cx + 360, y, z, '3011.dat', E)
  }
}

const denseWallLayer = (cx, y) => {
  const slots = [
    ...[-240, -80, 80, 240].flatMap((x) => [[cx + x, -280, H], [cx + x, 280, H]]),
    ...[-240, -80, 80, 240].flatMap((z) => [[cx - 360, z, E], [cx + 360, z, E]]),
  ]
  for (const [x, z, matrix] of slots.slice(0, 15)) add(14, x, y, z, '3011.dat', matrix)
  for (const x of [-200, -120, -40, 40, 120, 200]) add(14, cx + x, y, 0, '3437.dat')
}

const facadeOpenings = (cx) => {
  add(4, cx + 160, -192, 280, '61649.dat')
  add(15, cx + 160, -192, 340, '90265.dat')
}

const roofRing = (cx, y, count = 14) => {
  const slots = [
    ...[-240, -80, 80, 240].map((x) => [cx + x, -280, H]),
    ...[-240, -80, 80, 240].map((x) => [cx + x, 280, H]),
    ...[-240, -80, 80, 240].flatMap((z) => [[cx - 360, z, E], [cx + 360, z, E]]),
  ]
  for (const [x, z, matrix] of slots.slice(0, count)) add(14, x, y, z, '3011.dat', matrix)
}

const tree = (cx, firstStep) => {
  step(firstStep, 'three brown trunk bricks')
  for (const y of [-96, -144, -192]) add(6, cx, y, 440, '3437.dat')
  step(firstStep + 1, 'six green branch plates')
  for (const [x, y, z] of [[-80,-216,440],[80,-216,440],[0,-240,360],[0,-240,520],[-80,-264,440],[80,-264,440]]) add(2, cx + x, y, z, '40666.dat')
  step(firstStep + 2, 'upper trunk, bright-green crown and two branch plates')
  add(6, cx, -312, 440, '3437.dat')
  add(6, cx, -360, 440, '3437.dat')
  add(27, cx, -408, 440, '3437.dat')
  add(2, cx - 80, -432, 440, '40666.dat')
  add(2, cx + 80, -432, 440, '40666.dat')
}

step(1, 'two green 24x24 baseplates and central yellow path')
add(2, -480, -24, 0, '4268.dat')
add(2, 480, -24, 0, '4268.dat')
for (const z of [-280, -200, -120, -40, 40, 120, 200, 280]) add(14, 0, -48, z, '40666.dat')

step(2, 'left house first wall course and front openings')
facadeOpenings(-500)
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E],[360,-240,E],[360,-80,E],[360,80,E]]) add(14, -500+x, -96, z, '3011.dat', m)

step(3, 'left house second wall course')
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E],[360,-240,E],[360,-80,E]]) add(14,-500+x,-144,z,'3011.dat',m)
add(14,-740,-144,120,'3437.dat'); add(14,-660,-144,120,'3437.dat')

step(4, 'left house third wall course and side windows')
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E]]) add(14,-500+x,-192,z,'3011.dat',m)
add(14,-780,-192,120,'3437.dat'); add(14,-700,-192,120,'3437.dat')
add(4,-680,-192,280,'61649.dat'); add(15,-680,-192,340,'90265.dat')
add(4,-680,-192,-280,'61649.dat',S); add(15,-680,-192,-340,'90265.dat',S)

step(5, 'left house fourth wall course')
denseWallLayer(-500, -240)

step(6, 'left house top wall course')
for (const [x,z,m] of [[-240,-280,H],[-80,-280,H],[80,-280,H],[240,-280,H],[-240,280,H],[-80,280,H],[80,280,H],[240,280,H],[-360,-160,E],[-360,0,E],[-360,160,E],[360,0,E]]) add(14,-500+x,-288,z,'3011.dat',m)

step(7, 'two green roof plates on left house')
add(2, -660, -312, 0, '6490.dat', E)
add(2, -340, -312, 0, '6490.dat', E)

step(8, 'left roof first parapet course')
roofRing(-500, -360)
step(9, 'left roof second parapet course')
roofRing(-500, -408, 12)
step(10, 'left roof stair and red planters')
add(4,-660,-456,-40,'3437.dat'); add(4,-340,-456,-40,'3437.dat')
for (const [x,z] of [[-740,40],[-580,40],[-500,160],[-340,160]]) add(14,x,-456,z,'3011.dat')

step(11, 'eight striped fences around left roof terrace')
for (const x of [-680,-440,-200]) add(15,x,-552,220,'31021p01.dat')
for (const x of [-680,-440,-200]) add(15,x,-552,-220,'31021p01.dat',S)
add(15,-800,-552,0,'31021p01.dat',E); add(15,-200,-552,0,'31021p01.dat',W)

step(12, 'seven yellow front-path plates')
for (const [x,z] of [[-500,300],[-500,380],[-500,460],[-500,540],[-340,540],[-180,540],[-20,540]]) add(14,x,-48,z,'40666.dat')
tree(-900, 13)

step(16, 'right house first wall course and front openings')
facadeOpenings(500)
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E],[360,-240,E],[360,-80,E],[360,80,E]]) add(14,500+x,-96,z,'3011.dat',m)
step(17, 'right house second wall course')
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E],[360,-240,E],[360,-80,E]]) add(14,500+x,-144,z,'3011.dat',m)
add(14,260,-144,120,'3437.dat'); add(14,340,-144,120,'3437.dat')
step(18, 'right house third wall course and side windows')
for (const [x,z,m] of [[80,-280,H],[240,-280,H],[-240,0,H],[-80,0,H],[-360,-240,E],[-360,-80,E],[-360,80,E],[-360,240,E]]) add(14,500+x,-192,z,'3011.dat',m)
add(14,220,-192,120,'3437.dat'); add(14,300,-192,120,'3437.dat')
add(4,320,-192,280,'61649.dat'); add(15,320,-192,340,'90265.dat')
add(4,320,-192,-280,'61649.dat',S); add(15,320,-192,-340,'90265.dat',S)
step(19, 'right house fourth wall course')
denseWallLayer(500, -240)
step(20, 'right house top wall course')
for (const [x,z,m] of [[-240,-280,H],[-80,-280,H],[80,-280,H],[240,-280,H],[-240,280,H],[-80,280,H],[80,280,H],[240,280,H],[-360,-160,E],[-360,0,E],[-360,160,E],[360,0,E]]) add(14,500+x,-288,z,'3011.dat',m)
step(21, 'two green roof plates on right house')
add(2,340,-312,0,'6490.dat',E); add(2,660,-312,0,'6490.dat',E)
step(22, 'right roof parapet')
roofRing(500,-360)
step(23, 'four striped fences on right terrace')
for (const x of [340,660]) { add(15,x,-456,220,'31021p01.dat'); add(15,x,-456,-220,'31021p01.dat',S) }
step(24, 'eight red frames form four two-unit canopy columns')
for (const [x,z,m] of [[200,-120,E],[800,-120,W],[200,120,E],[800,120,W]]) {
  add(4,x,-504,z,'61649.dat',m); add(4,x,-648,z,'61649.dat',m)
}
step(25, 'green canopy roof')
add(2,500,-672,0,'6490.dat')
step(26, 'seven yellow front-path plates')
for (const [x,z] of [[500,300],[500,380],[500,460],[500,540],[340,460],[180,460],[20,460]]) add(14,x,-48,z,'40666.dat')
tree(900,27)
step(30, 'finished neighborhood, no additions')
lines.push('0 STEP','0 NOFILE','')

fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.filter((line) => line.startsWith('1 ')).length} placements`)

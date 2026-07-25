import fs from 'node:fs'

const out = 'scripts/ldraw-models/3-kua-hai-da-qiao.ldr'
const lines = [
  '0 3+ 跨海大桥 (Sea-Crossing Bridge) - source-reviewed reconstruction',
  '0 Name: 3-kua-hai-da-qiao.ldr',
  '0 Author: OpenAI',
  '0 !LDRAW_ORG Model',
  '0 !LICENSE Redistributable under CC BY 4.0 : see CAreadme.txt',
  '0 // Source: C:/Users/arron/Downloads/pdf预览/3+跨海大桥搭建说明_pdf',
  '0 // Duplo grid: 40 LDU per stud; +Y downward; source-page BOM preserved.',
]

const M = { n: '1 0 0 0 1 0 0 0 1', e: '0 0 1 0 1 0 -1 0 0' }
const add = (color, x, y, z, part, o = 'n') => lines.push(`1 ${color} ${x} ${y} ${z} ${M[o]} ${part}`)
const step = (n, text) => { if (n > 1) lines.push('0 STEP'); lines.push(`0 // STEP ${n} - ${text}`) }

// Page 1: two ground plates, one road plate and the first striped pier.
step(1, 'two green baseplates, first pier and road plate')
add(2, -480, -24, 0, '4268.dat'); add(2, 480, -24, 0, '4268.dat')
for (const [y, color] of [[-72, 4], [-120, 14], [-168, 4], [-216, 14]]) { add(color, -640, y, -60, '3437.dat'); add(color, -640, y, 60, '3437.dat') }
add(2, -640, -240, 0, '6490.dat')

// Page 2: complete the three-pier road deck.
step(2, 'three striped piers and three road plates')
for (const x of [0, 640]) {
  for (const [y, color] of [[-72, 4], [-120, 14], [-168, 4], [-216, 14]]) { add(color, x, y, -60, '3437.dat'); add(color, x, y, 60, '3437.dat') }
  add(2, x, -240, 0, '6490.dat')
}

// Each arch uses two parallel stair rails: 5 pairs of 2x2 bricks on each side,
// two 5-brick central columns, and two 2x4 cap plates on each face.
function arch(x, page) {
  step(page, `yellow stepped arch at x=${x}`)
  for (const z of [-120, 120]) {
    for (const [dx, y] of [[-280, -288], [-240, -336], [-200, -384], [-160, -432], [-120, -480], [120, -480], [160, -432], [200, -384], [240, -336], [280, -288]]) add(14, x + dx, y, z, '3437.dat')
  }
  for (const z of [-120, 120]) for (const y of [-288, -336, -384, -432, -480]) add(14, x, y, z, '3011.dat', 'e')
  for (const z of [-120, 120]) for (const dx of [-80, 80]) add(14, x + dx, -504, z, '40666.dat')
}
arch(640, 3); arch(0, 4); arch(-640, 5)

step(6, 'two red wheeled vehicles under the arches')
add(4, -320, -288, 0, '41989.dat'); add(4, 320, -288, 0, '41989.dat')

// Page 7: a 24 x 6 grid of east-facing 2x4 plates covers both 24x24 bases.
// Four tiles around each of the three piers are left open: 144 - 12 = 132.
step(7, 'full blue and light-blue water field')
const pierX = new Set([-640, 0, 640])
let water = 0
for (let col = 0; col < 24; col++) for (let row = 0; row < 6; row++) {
  const x = -920 + col * 80
  const z = -400 + row * 160
  if ((z === -80 || z === 80) && [...pierX].some((px) => Math.abs(x - px) === 40)) continue
  add((col + row) % 2 ? 9 : 1, x, -48, z, '40666.dat', 'e')
  water++
}
if (water !== 132) throw new Error(`water placement count ${water}, expected 132`)

step(8, 'two yellow and lime island rings')
function island(cx, color) {
  add(color, cx, -72, -280, '6490.dat')
  for (const [dx, z, o] of [[-80, -400, 'n'], [80, -400, 'n'], [-80, -160, 'n'], [80, -160, 'n'], [-240, -280, 'e'], [240, -280, 'e']]) add(color, cx + dx, -120, z, '3011.dat', o)
}
island(-320, 14); island(320, 27)

step(9, 'black finishing plates on the islands')
for (const cx of [-320, 320]) {
  add(0, cx, -96, -320, '40666.dat')
  add(0, cx, -96, -240, '40666.dat')
  add(0, cx, -144, -280, '3437.dat')
}
lines.push('0 STEP', '0 NOFILE', '')
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}: ${lines.length} lines, water=${water}`)

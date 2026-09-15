import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { createOssClient } from '../lib/utils/oss-client.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const OUT = path.join(ROOT, 'public/projects/corrections')
const DATE = '20260915'
const font = "'Noto Sans CJK SC', 'Unifont', sans-serif"
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const text = (x, y, value, size = 30, extra = '') => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" ${extra}>${esc(value)}</text>`
const line = (x1, y1, x2, y2, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`

function frame(width, height, title, subtitle) {
  return `<rect width="${width}" height="${height}" rx="28" fill="#f8fafc"/><rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="22" fill="white" stroke="#dbe4ee" stroke-width="3"/>${text(74, 102, title, 48, 'font-weight="700" fill="#102a43"')}${text(76, 148, subtitle, 25, 'fill="#526779"')}`
}

function circuitSvg() {
  const w = 1600, h = 1000
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${frame(w, h, '光控小夜灯 · 接线对照', '按行核对每一条连接；箭头表示连接方向')}`
  const rows = [
    '① +4.5V → 10kΩ → 节点 A → 光敏电阻 → GND',
    '② 节点 A → 4.7kΩ → S8050 基极 B',
    '③ S8050 发射极 E → GND',
    '④ +4.5V → 330Ω → LED 阳极（+）',
    '⑤ LED 阴极（−）→ S8050 集电极 C',
  ]
  rows.forEach((value, index) => {
    const y = 245 + index * 125
    s += `<rect x="115" y="${y - 54}" width="1370" height="88" rx="18" fill="${index % 2 ? '#f0f7ff' : '#f0fdf4'}" stroke="#cbdbe8" stroke-width="2"/>`
    s += text(155, y, value, 36, 'font-weight="700" fill="#102a43"')
  })
  s += `<rect x="115" y="860" width="1370" height="70" rx="16" fill="#fff7ed" stroke="#fed7aa" stroke-width="2"/>${text(155, 906, 'S8050：B＝基极｜E＝发射极｜C＝集电极；以所用数据表/封装标注为准。', 26, 'fill="#7c2d12"')}</svg>`
  return s
}

function stampSvg() {
  const w = 1400, h = 900
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${frame(w, h, '几何印章肥皂｜凸起印面与纸上印迹', '左：雕刻后保留的凸起几何图案；右：蘸印泥后的对应印迹')}`
  s += `<g stroke="#7c3aed" stroke-width="9" stroke-linejoin="round"><rect x="130" y="280" width="420" height="420" rx="24" fill="#f1e8ff"/><path d="M220 590V390h240v200z" fill="none"/><path d="M220 390l120-90 120 90" fill="none"/><circle cx="340" cy="510" r="62" fill="#f7c948"/><path d="M240 620h200" stroke="#db2777"/></g>`
  s += `<path d="M620 490h130" stroke="#64748b" stroke-width="8"/><path d="m720 460 40 30-40 30" fill="none" stroke="#64748b" stroke-width="8"/>`
  s += `<rect x="850" y="280" width="420" height="420" rx="24" fill="white" stroke="#cbd5e1" stroke-width="5"/><g stroke="#c2410c" stroke-width="11" fill="none" stroke-linejoin="round"><path d="M940 590V390h240v200z"/><path d="M940 390l120-90 120 90"/><circle cx="1060" cy="510" r="62" fill="#f7c948"/><path d="M960 620h200"/></g>`
  s += text(235, 755, '肥皂块：凸起图案', 30, 'font-weight="700" fill="#6d28d9"') + text(925, 755, '纸张：对应印迹', 30, 'font-weight="700" fill="#c2410c"') + text(165, 840, '削去留白，保持印面平整；只做方形、三角形、圆形等几何元素。', 27, 'fill="#334e68"') + '</svg>'
  return s
}

function mathSvg() {
  const w = 1800, h = 1200
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${frame(w, h, '数字黑洞 6174｜固定四位格式', '降序排列 − 升序排列；升序不足四位时补前导 0')}`
  s += `<rect x="90" y="205" width="1620" height="430" rx="20" fill="#f0fdf4" stroke="#86efac" stroke-width="3"/>`
  const rows = [['1', '3812', '8321 − 1238', '7083'], ['2', '7083', '8730 − 0378', '8352'], ['3', '8352', '8532 − 2358', '6174'], ['4', '6174', '7641 − 1467', '6174']]
  rows.forEach(([n, a, calc, out], i) => { const y = 285 + i * 90; s += text(145, y, `步骤 ${n}`, 29, 'font-weight="700" fill="#166534"') + text(350, y, a, 38, 'font-weight="700" fill="#102a43"') + text(690, y, calc, 38, 'fill="#102a43"') + text(1370, y, `→ ${out}`, 38, 'font-weight="700" fill="#166534"') })
  s += text(120, 710, '三位数拓展（同样补足三位）', 34, 'font-weight="700" fill="#102a43"')
  s += `<rect x="100" y="755" width="1600" height="240" rx="20" fill="#eff6ff" stroke="#93c5fd" stroke-width="3"/>${text(160, 850, '521 − 125 = 396', 40, 'font-weight="700" fill="#1e3a8a"')}${text(660, 850, '963 − 369 = 594', 40, 'font-weight="700" fill="#1e3a8a"')}${text(1160, 850, '954 − 459 = 495', 40, 'font-weight="700" fill="#1e3a8a"')}${text(150, 930, '四位数：不全相同 → 最多 7 步到 6174；每次都保留位数。', 29, 'fill="#334e68"')}</svg>`
  return s
}

function threeDigitSvg() {
  const w = 1500, h = 760
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${frame(w, h, '三位数拓展｜固定三位格式', '降序排列 − 升序排列；每一步都保留三位数字')}`
  s += `<rect x="90" y="210" width="1320" height="350" rx="20" fill="#eff6ff" stroke="#93c5fd" stroke-width="3"/>`
  const rows = [['1', '521 − 125', '396'], ['2', '963 − 369', '594'], ['3', '954 − 459', '495']]
  rows.forEach(([n, calc, out], i) => { const y = 300 + i * 90; s += text(170, y, `步骤 ${n}`, 30, 'font-weight="700" fill="#1e3a8a"') + text(470, y, calc, 42, 'font-weight="700" fill="#102a43"') + text(1080, y, `→ ${out}`, 42, 'font-weight="700" fill="#1e3a8a"') })
  s += text(150, 650, '示例：521 的三个数字不全相同；每轮均按三位数排列并相减。', 28, 'fill="#334e68"') + '</svg>'
  return s
}

const diagrams = [
  ['20260915-project-158-circuit', circuitSvg()],
  ['20260915-project-343-stamp', stampSvg()],
  ['20260915-project-378-kaprekar-four-digit', mathSvg()],
  ['20260915-project-378-kaprekar-three-digit', threeDigitSvg()],
]

function loadEnv() {
  return fs.readFile(path.join(ROOT, '.env.local'), 'utf8').then(raw => {
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || process.env[match[1]]) continue
      let value = match[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      process.env[match[1]] = value
    }
  })
}

async function retryNetwork(operation, label, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation() } catch (error) {
      if (attempt === attempts) throw error
      console.warn(`${label} failed (${error?.code || error?.message || 'network error'}); retrying ${attempt}/${attempts - 1}`)
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
}

await fs.mkdir(OUT, { recursive: true })
const written = []
for (const [name, svg] of diagrams) {
  const svgPath = path.join(OUT, `${name}.svg`)
  const pngPath = path.join(OUT, `${name}.png`)
  await fs.writeFile(svgPath, svg, 'utf8')
  await sharp(Buffer.from(svg)).png().toFile(pngPath)
  const meta = await sharp(pngPath).metadata()
  const digest = createHash('sha256').update(await fs.readFile(pngPath)).digest('hex')
  written.push({ name, svg: svgPath, png: pngPath, width: meta.width, height: meta.height, sha256: digest })
}
console.log(JSON.stringify({ generated: written.map(({ name, width, height, sha256 }) => ({ name, width, height, sha256 })) }, null, 2))

if (!process.argv.includes('--no-upload')) {
  await loadEnv()
  const client = createOssClient()
  for (const item of written) {
    const key = `projects/corrections/${path.basename(item.png)}`
    await retryNetwork(() => client.put(key, item.png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' }, timeout: 120_000 }), `upload ${key}`)
    const remote = (await retryNetwork(() => client.get(key), `readback ${key}`)).content
    const remoteHash = createHash('sha256').update(remote).digest('hex')
    if (remoteHash !== item.sha256) throw new Error(`OSS readback hash mismatch for ${key}`)
    console.log(`uploaded+verified ${key} ${item.sha256}`)
  }
}

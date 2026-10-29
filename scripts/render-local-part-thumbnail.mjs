/** Render self-contained LDraw triangle/quad geometry in its requested colour.
 * node scripts/render-local-part-thumbnail.mjs source.dat 7 output.webp [packed-part.dat]
 * Nested parts are deliberately rejected instead of silently omitted.
 */
import { readFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const [partPath, colorCode, outputPath, packedPart] = process.argv.slice(2)
if (!partPath || !/^\d+$/.test(colorCode ?? '') || !outputPath) {
  throw new Error('Usage: node scripts/render-local-part-thumbnail.mjs source.dat colorCode output.webp [packed-part.dat]')
}
const colors = JSON.parse(await readFile(new URL('../lib/courses/ldraw-kit-colors.json', import.meta.url)))
if (!colors[colorCode]) throw new Error(`Unknown colour: ${colorCode}`)
const positions = []
const vertexColors = []
let source = await readFile(partPath, 'utf8')
if (packedPart) {
  const sections = source.split(/^0 FILE /m).slice(1)
  const section = sections.find((item) => item.slice(0, item.indexOf('\n')).trim() === packedPart)
  if (!section) throw new Error(`Missing packed part: ${packedPart}`)
  source = section.slice(section.indexOf('\n') + 1)
}
for (const line of source.split(/\r?\n/)) {
  const fields = line.trim().split(/\s+/)
  const type = Number(fields[0])
  if (type === 1) throw new Error('Nested LDraw parts must be packed before rendering')
  if (type !== 3 && type !== 4) continue
  const color = colors[fields[1] === '16' ? colorCode : fields[1]]
  if (!color) throw new Error(`Unknown geometry colour: ${fields[1]}`)
  const coords = fields.slice(2).map(Number)
  if (coords.length !== (type === 3 ? 9 : 12) || !coords.every(Number.isFinite)) throw new Error('Invalid geometry')
  const triangleIndices = type === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]
  for (const index of triangleIndices) {
    // LDraw's Y axis points down.
    positions.push(coords[index * 3], -coords[index * 3 + 1], -coords[index * 3 + 2])
    vertexColors.push(color.hex)
  }
}
if (!positions.length) throw new Error('No geometry found')
const threePath = resolve(dirname(require.resolve('three')), 'three.module.js')
const threeCorePath = resolve(dirname(require.resolve('three')), 'three.core.js')
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 192, height: 192 }, deviceScaleFactor: 1 })
  await page.route('http://thumbnail.local/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/three.module.js' || path === '/three.core.js') {
      await route.fulfill({ contentType: 'text/javascript', body: await readFile(path === '/three.module.js' ? threePath : threeCorePath, 'utf8') })
    } else {
      await route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:white"></body></html>' })
    }
  })
  await page.goto('http://thumbnail.local/')
  await page.evaluate(async ({ positions, vertexColors }) => {
    const THREE = await import('/three.module.js')
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors.flatMap((hex) => {
      const color = new THREE.Color(hex)
      return [color.r, color.g, color.b]
    }), 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    const center = geometry.boundingBox.getCenter(new THREE.Vector3())
    geometry.translate(-center.x, -center.y, -center.z)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('white')
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }))
    scene.add(mesh)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.1))
    const light = new THREE.DirectionalLight(0xffffff, 2.2)
    light.position.set(-180, 240, 180)
    scene.add(light)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000)
    camera.position.set(220, 180, 260)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const box = new THREE.Box3().setFromObject(mesh)
    const projected = []
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) projected.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
    const half = Math.max(...projected.flatMap((v) => [Math.abs(v.x), Math.abs(v.y)])) * 1.08
    Object.assign(camera, { left: -half, right: half, top: half, bottom: -half })
    camera.updateProjectionMatrix()
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(192, 192)
    renderer.setPixelRatio(1)
    document.body.appendChild(renderer.domElement)
    renderer.render(scene, camera)
  }, { positions, vertexColors })
  await mkdir(dirname(outputPath), { recursive: true })
  await sharp(await page.locator('canvas').screenshot()).resize(96, 96).webp({ quality: 85 }).toFile(outputPath)
  console.info(outputPath)
} finally {
  await browser.close()
}

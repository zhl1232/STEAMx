/** CPU projection of the actual scene geometry. Not a browser/WebGL screenshot. */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import * as THREE from "three"
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js"
import { Window } from "happy-dom"
import sharp from "sharp"
import { createBookGarden, fitBookCamera, lightBookScene } from "../../lib/textbook3d/native/book-garden"
import { bookLayoutFor, projectReadingPage } from "../../lib/textbook3d/native/book-page-layout"

async function main() {
const output = process.env.TEXTBOOK_GEOMETRY_PREVIEW_DIR || "/tmp/textbook-book-geometry"
await mkdir(output, { recursive: true })
const window = new Window()
Object.defineProperty(globalThis, "document", { configurable: true, value: window.document })

for (const view of [
  { name: "open-book", width: 1200, height: 760, page: 0, fold: 1, leafAngle: 0, turning: false },
  { name: "turning-page", width: 1200, height: 760, page: 1, fold: 0, leafAngle: Math.PI * 0.58, turning: true },
  { name: "phone-book", width: 390, height: 730, page: 1, fold: 1, leafAngle: 0, turning: false },
  { name: "landscape-book", width: 844, height: 278, page: 1, fold: 1, leafAngle: 0, turning: false },
] as const) {
  const scene = new THREE.Scene()
  const garden = createBookGarden()
  const layout = bookLayoutFor(view.width, view.height)
  garden.setLayout(layout)
  garden.setPose(view)
  scene.add(garden.root)
  const releaseLight = lightBookScene(scene)
  // CPU painter sorting cannot depth-test the very large desk plane. Use an
  // explicit background and a modest SVG light approximation (no PBR/tone map).
  scene.getObjectByName("reading-desk")!.visible = false
  scene.traverse((node) => { if (node instanceof THREE.Light) node.intensity *= 0.28 })
  scene.add(new THREE.AmbientLight("#fff8e7", 0.75))
  // SVGRenderer cannot draw InstancedMesh. Expand the same instance matrices
  // for this CPU export only; the production scene retains GPU instancing.
  const expanded: THREE.InstancedMesh[] = []
  const exportMaterials: THREE.Material[] = []
  scene.traverse((node) => { if (node instanceof THREE.InstancedMesh) expanded.push(node) })
  for (const batch of expanded) {
    const group = new THREE.Group()
    group.position.copy(batch.position); group.quaternion.copy(batch.quaternion); group.scale.copy(batch.scale)
    for (let index = 0; index < batch.count; index++) {
      let surface = batch.material
      if (batch.instanceColor && surface instanceof THREE.MeshStandardMaterial) {
        const tinted = surface.clone()
        const tint = new THREE.Color()
        batch.getColorAt(index, tint)
        tinted.color.multiply(tint)
        exportMaterials.push(tinted)
        surface = tinted
      }
      const instance = new THREE.Mesh(batch.geometry, surface)
      batch.getMatrixAt(index, instance.matrix)
      instance.matrix.decompose(instance.position, instance.quaternion, instance.scale)
      group.add(instance)
    }
    batch.parent!.add(group)
    batch.visible = false
  }
  const camera = new THREE.PerspectiveCamera(38, view.width / view.height, 0.1, 100)
  const fit = fitBookCamera(camera, view.turning ? undefined : garden.root, layout)
  camera.lookAt(fit.center)
  camera.updateMatrixWorld()
  const renderer = new SVGRenderer()
  // The SVG painter has no depth buffer. Keep the authored book-then-plants
  // order to avoid large page triangles being sorted over small foliage.
  renderer.sortObjects = false
  renderer.sortElements = false
  renderer.setSize(view.width, view.height)
  renderer.setClearColor(new THREE.Color("#e5ddca"), 1)
  renderer.setQuality("high")
  const book = garden.root.getObjectByName("botanical-pop-up-book")!
  const layers = garden.root.children.map((object) => ({ object, visible: object.visible }))
  layers.forEach(({ object }) => { if (object !== book) object.visible = false })
  renderer.render(scene, camera)
  const paperLayer = renderer.domElement.innerHTML
  layers.forEach(({ object, visible }) => { object.visible = object === book ? false : visible })
  renderer.sortObjects = true
  renderer.sortElements = true
  renderer.render(scene, camera)
  const plantsLayer = renderer.domElement.innerHTML
  renderer.domElement.innerHTML = paperLayer + plantsLayer
  const svg = renderer.domElement.outerHTML
  await writeFile(path.join(output, `${view.name}.svg`), svg)
  await sharp(Buffer.from(svg)).flatten({ background: "#e5ddca" }).png().toFile(path.join(output, `${view.name}.png`))
  if (view.name === "open-book") {
    // An explicitly labelled typesetting proof, NOT a rasterization of React DOM.
    // Lines use the same camera/page projection; browser wrapping still needs acceptance.
    const { matrix: m } = projectReadingPage(camera, view.width, view.height, garden.paper, layout)
    const point = (x: number, y: number) => {
      const w = m[3] * x + m[7] * y + 1
      return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w]
    }
    const line = (text: string, y: number, size: number, color = "#293f37", weight = 400) => {
      const p = point(0, y), x = point(1, y), yy = point(0, y + 1)
      return `<text transform="matrix(${x[0]-p[0]},${x[1]-p[1]},${yy[0]-p[0]},${yy[1]-p[1]},${p[0]},${p[1]})" font-family="Noto Serif CJK SC" font-size="${size}" font-weight="${weight}" fill="${color}">${text}</text>`
    }
    let proof = [
      line("周围的植物 · 第 1 课", 16, 11, "#9b613c"),
      line("我们知道的植物", 60, 29, "#293f37", 700),
      line("大树、小草、花，都是植物。", 105, 18),
      line("它们都是活的，会生长。", 137, 18),
      line("大树", 184, 20, "#365b46", 700),
      line("高高的，有树干", 210, 14, "#64715f"),
      line("从树根往上看：树干托着树枝，", 243, 16),
      line("树枝上长着许多叶子。", 270, 16),
      line("猜一猜：哪个是植物？", 327, 16, "#8c593c", 700),
      line("□ 小草    □ 石头    □ 小狗", 363, 16),
      line("选一个，说说你的理由。", 397, 12, "#64715f"),
    ].join("")
    const tab = new THREE.Vector3(1.86, 0.15, 1.82).project(camera)
    const tx = (tab.x + 1) * view.width / 2, ty = (1 - tab.y) * view.height / 2
    for (const [index, name] of ["大树", "小草", "花"].entries()) {
      const x = tx - 113 + index * 77
      proof += `<rect x="${x}" y="${ty-20}" width="70" height="40" rx="3" fill="${index ? "#f6f0de" : "#365b46"}" stroke="#aab394"/><text x="${x+35}" y="${ty+6}" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="15" fill="${index ? "#425a42" : "#f8f1df"}">${name}</text>`
    }
    proof += `<text x="24" y="${view.height-24}" font-family="Noto Sans CJK SC" font-size="12" fill="#5c6959">版式与源码几何样板 · 非浏览器 / WebGL 截图</text>`
    const composed = svg.replace("</svg>", `<g transform="translate(${-view.width/2},${-view.height/2})">${proof}</g></svg>`)
    await writeFile(path.join(output, "spread-design-proof.svg"), composed)
    await sharp(Buffer.from(composed)).flatten({ background: "#e5ddca" }).png().toFile(path.join(output, "spread-design-proof.png"))
  }
  garden.dispose()
  releaseLight()
  exportMaterials.forEach((surface) => surface.dispose())
}
await writeFile(path.join(output, "README.txt"), "Actual book/plant source geometry projected with Three.js SVGRenderer on CPU. These images do not show WebGL material/shadows, DOM text layout, real-browser performance or device acceptance. They are not concept art and not application screenshots.\n")
console.info(`CPU geometry previews (not WebGL screenshots): ${output}`)

}
void main().catch((error) => { console.error(error); process.exitCode = 1 })

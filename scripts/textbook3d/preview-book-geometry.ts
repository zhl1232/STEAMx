/** CPU projection of the actual scene geometry. Not a browser/WebGL screenshot. */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import * as THREE from "three"
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js"
import { Window } from "happy-dom"
import sharp from "sharp"
import { bookTurnCameraScale, createBookGarden, fitBookCamera, lightBookScene } from "../../lib/textbook3d/native/book-garden"

async function main() {
const output = process.env.TEXTBOOK_GEOMETRY_PREVIEW_DIR || "/tmp/textbook-book-geometry"
await mkdir(output, { recursive: true })
const window = new Window()
Object.defineProperty(globalThis, "document", { configurable: true, value: window.document })

for (const view of [
  { name: "open-book", width: 1200, height: 760, page: 0, fold: 1, leafAngle: 0, turning: false },
  { name: "turning-page", width: 1200, height: 760, page: 1, fold: 0, leafAngle: Math.PI * 0.58, turning: true },
  { name: "phone-book", width: 390, height: 300, page: 1, fold: 1, leafAngle: 0, turning: false },
] as const) {
  const scene = new THREE.Scene()
  const garden = createBookGarden()
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
  scene.traverse((node) => { if (node instanceof THREE.InstancedMesh) expanded.push(node) })
  for (const batch of expanded) {
    const group = new THREE.Group()
    group.position.copy(batch.position); group.quaternion.copy(batch.quaternion); group.scale.copy(batch.scale)
    for (let index = 0; index < batch.count; index++) {
      const instance = new THREE.Mesh(batch.geometry, batch.material)
      batch.getMatrixAt(index, instance.matrix)
      instance.matrix.decompose(instance.position, instance.quaternion, instance.scale)
      group.add(instance)
    }
    batch.parent!.add(group)
    batch.visible = false
  }
  const camera = new THREE.PerspectiveCamera(38, view.width / view.height, 0.1, 100)
  const fit = fitBookCamera(camera)
  camera.position.sub(fit.center).multiplyScalar(bookTurnCameraScale(view.leafAngle)).add(fit.center)
  camera.lookAt(fit.center)
  camera.updateMatrixWorld()
  const renderer = new SVGRenderer()
  renderer.setSize(view.width, view.height)
  renderer.setClearColor(new THREE.Color("#e1dac8"), 1)
  renderer.setQuality("high")
  renderer.render(scene, camera)
  const svg = renderer.domElement.outerHTML
  await writeFile(path.join(output, `${view.name}.svg`), svg)
  await sharp(Buffer.from(svg)).flatten({ background: "#e1dac8" }).png().toFile(path.join(output, `${view.name}.png`))
  garden.dispose()
  releaseLight()
}
await writeFile(path.join(output, "README.txt"), "Actual book/plant source geometry projected with Three.js SVGRenderer on CPU. These images do not show WebGL material/shadows, DOM text layout, real-browser performance or device acceptance. They are not concept art and not application screenshots.\n")
console.info(`CPU geometry previews (not WebGL screenshots): ${output}`)

}
void main().catch((error) => { console.error(error); process.exitCode = 1 })

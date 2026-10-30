import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))

// This script prepares prompts and encodes already generated images. It never
// calls a generation API, changes database content, or approves an illustration.
export function buildDemonstrationPrompt(project, plan) {
  if (Number(project.id) !== Number(plan.id) || project.title !== plan.title) throw new Error('Scene identity mismatch')
  if (!plan.visualPlan?.trim() || !['demonstration', 'principle'].includes(plan.kind)) throw new Error('Missing reviewed scene plan')
  const steps = project.steps
  if (!Array.isArray(steps) || steps.length < 4 || steps.length > 6) throw new Error('Unexpected step count')
  const layout = steps.length === 5
    ? 'Exactly FIVE panels: two columns for the first four panels, then a wide fifth panel across the bottom. Do not invent a sixth step.'
    : `Exactly ${steps.length} panels, two columns by ${steps.length / 2} rows, reading left-to-right then top-to-bottom.`
  const principle = plan.kind === 'principle'
  return `Use case: scientific-educational
Asset type: a complete illustrated project demonstration sheet, project ${project.id}.
Primary request: Create an attractive, precise Chinese educational illustration for “${project.title}”, showing one coherent project across the panels. Draw the actual materials, arrangements, actions, or supported principles. This must be a pictorial demonstration, never a text-only flowchart, checklist, collection of stock photos, or unrelated example images.

Layout: portrait sheet, ${layout} Short Chinese headings above large pictures. Keep generous gutters and every panel completely in-frame. Use the same camera angle, scale, base, background, objects, and color identity across the sequence; allow an explicitly labelled close-up only when necessary to explain a connection. Drawings occupy at least 80% of the area. Readable Chinese headings. Avoid excessive prose or decorative icons.
Style: warm, precise educational illustration with tangible paper/wood/fabric/glass/metal textures as appropriate to this project, softly shaded, restrained colors, clear construction edges. Friendly to families; coherent with a high-quality illustrated craft manual. No fake photographic claims, glossy impossible toy renders, magical effects, stock-photo collages, or decorative nonsense. Mathematical/circuit diagrams should use clean crisp lines and exact topology, not painterly ambiguity.

Text, verbatim:
Main title: “${project.title}”
Subtitle: “${principle ? '原理与结构示意' : '连续演示'}”
Panel headings, in this exact order:
${steps.map((s, i) => `“${i + 1} ${s.title}”`).join('\n')}
Small footer: “生成演示图”
Use only these headings plus indispensable short labels explicitly required by the scene plan below. No invented brands, claims, measurements, test data, or extra instructions.

Project materials (source constraints, do not introduce a different apparatus):
${(project.materials || []).map(m => `- ${m}`).join('\n')}

Effective written instructions, for alignment:
${steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n')}

REVIEWED VISUAL PLAN — apply this concrete plan to the drawings:
${plan.visualPlan}
${plan.concerns?.length ? `\nSpecific limitations to respect:\n${plan.concerns.map(c => `- ${c}`).join('\n')}` : ''}

${principle ? 'This is a principle/structure illustration, not a claim that an incomplete mechanism has been built or runs. Where the reviewed plan identifies an unconfirmed connection or missing condition, visibly label that exact missing point briefly. Do not draw unsupported successful operation, fabricate measurements, invent a circuit, or silently supply unspecified structural details. Follow the reviewed visual plan when literal source instructions would imply an unsupported result.' : 'Show the evolving state cumulatively: later panels preserve all earlier construction and only add the stated action. Distinguish loose parts from attached parts, before from after, observations from conclusions. For trials or comparisons, keep controlled conditions visibly identical and leave recording fields blank rather than inventing experimental results.'}
CONTINUITY IS THE TOP PRIORITY: one actual object or clearly labelled controlled comparison, same number and kind of parts, same connections, same material identities, same composition. Later states never turn into a different craft, species, apparatus, circuit or geometry. A common visual style alone is insufficient. No spontaneous components, missing supports, disconnected powered devices, impossible knots, incorrect arithmetic, or fabricated observations. Verify the panel count, order, Chinese titles and logic before rendering.`
}

export async function acceptGeneratedDemonstration({ project, plan, generatedPath, version = 'v1', finalPrompt }) {
  if (!/^v[1-9]\d*$/.test(version)) throw new Error('Invalid asset version')
  const prompt = finalPrompt || buildDemonstrationPrompt(project, plan)
  const image = `/project-guides/demos/project-${project.id}-${version}.webp`
  const destination = resolve(root, `public${image}`)
  await mkdir(resolve(root, 'public/project-guides/demos'), { recursive: true })
  // Encoding only: no cropping, compositing, resizing, or content modification.
  await sharp(generatedPath).webp({ quality: 94, effort: 6 }).toFile(destination)
  const promptDir = resolve(root, 'output/imagegen/project-demonstrations')
  await mkdir(promptDir, { recursive: true })
  await writeFile(resolve(promptDir, `project-${project.id}-${version}.prompt.txt`), prompt + '\n')
  return {
    id: project.id, title: project.title, category: project.category,
    image, sourceImage: project.image,
    description: project.description || '', materials: project.materials || [],
    steps: project.steps.map(({ title, description }) => ({ title, description })),
    kind: plan.kind,
  }
}

export async function checkDemonstrationAssets(projects = []) {
  const manifest = await readJson(resolve(root, 'lib/project/demonstration-images.data.json'))
  const seen = new Set()
  let bytes = 0
  for (const entry of manifest) {
    if (seen.has(entry.id)) throw new Error(`Duplicate illustration ${entry.id}`)
    seen.add(entry.id)
    if (!new RegExp(`^/project-guides/demos/project-${entry.id}-(?:garden-)?v\\d+\\.(?:webp|png)$`).test(entry.image)
      || !entry.title || !entry.sourceImage || !entry.materials?.length || !entry.steps?.length
      || !['demonstration', 'principle'].includes(entry.kind)) throw new Error(`Incomplete illustration ${entry.id}`)
    const file = await readFile(resolve(root, `public${entry.image}`))
    const metadata = await sharp(file).metadata()
    if (!['webp', 'png'].includes(metadata.format) || metadata.width < 512 || metadata.height < 512) throw new Error(`Invalid asset ${entry.id}`)
    bytes += file.length
    if (projects.length) {
      const project = projects.find(item => Number(item.id) === Number(entry.id))
      if (!project || project.title !== entry.title || project.category !== entry.category
        || project.description !== entry.description
        || JSON.stringify(project.materials) !== JSON.stringify(entry.materials)
        || JSON.stringify(project.steps.map(({ title, description }) => ({ title, description }))) !== JSON.stringify(entry.steps)) {
        throw new Error(`Stale instruction binding ${entry.id}`)
      }
    }
  }
  return { registered: manifest.length, bytes, missingProjects: projects.filter(project => !seen.has(project.id)).map(project => project.id) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, projectsPath, plansPath, argument] = process.argv.slice(2)
  if (mode === 'check') {
    const result = await checkDemonstrationAssets(projectsPath ? await readJson(projectsPath) : [])
    console.log(JSON.stringify(result))
    if (plansPath === '--require-complete' && result.missingProjects.length) process.exitCode = 1
  } else {
  const projects = await readJson(projectsPath)
  const plans = await readJson(plansPath)
  const find = (rows, id) => {
    const item = rows.find(row => Number(row.id) === Number(id))
    if (!item) throw new Error(`Missing project/plan ${id}`)
    return item
  }
  if (mode === 'prompts') {
    const ids = argument.split(',').map(Number)
    console.log(JSON.stringify(ids.map(id => ({ id, prompt: buildDemonstrationPrompt(find(projects, id), find(plans, id)) }))))
  } else if (mode === 'accept') {
    // The caller supplies ONLY images that were visually inspected and accepted.
    const accepted = await readJson(argument)
    const manifestPath = resolve(root, 'lib/project/demonstration-images.data.json')
    const manifest = await readJson(manifestPath)
    for (const image of accepted) {
      const entry = await acceptGeneratedDemonstration({ project: find(projects, image.id), plan: find(plans, image.id), generatedPath: image.path, version: image.version || 'v1', finalPrompt: image.finalPrompt })
      const previous = manifest.findIndex(row => Number(row.id) === Number(image.id))
      if (previous >= 0) manifest[previous] = entry
      else manifest.push(entry)
      console.log(`${image.id}: ${entry.image}`)
    }
    manifest.sort((a, b) => a.id - b.id)
    const pending = `${manifestPath}.tmp`
    await writeFile(pending, JSON.stringify(manifest, null, 2) + '\n')
    await rename(pending, manifestPath)
  } else throw new Error('Use prompts <projects.json> <plans.json> <id,id> or accept <projects.json> <plans.json> <accepted.json>')
  }
}

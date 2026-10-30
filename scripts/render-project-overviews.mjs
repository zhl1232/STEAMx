import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const palettes = {
  科学: { ink: '#185a4b', paper: '#f0f7f2', accent: '#268565', pale: '#d9ebe0' },
  技术: { ink: '#194f75', paper: '#f0f6fa', accent: '#2b78a2', pale: '#d8e9f3' },
  工程: { ink: '#775029', paper: '#faf6ee', accent: '#a06a32', pale: '#ede0c7' },
  艺术: { ink: '#794752', paper: '#faf2f2', accent: '#a75d6d', pale: '#efdce0' },
  数学: { ink: '#574781', paper: '#f5f3fa', accent: '#8063af', pale: '#e5ddf1' },
}

export function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

// This is an outline of the actual instructions, not a fabricated photograph,
// construction drawing, or claim that the activity has been physically tested.
export function renderProjectOverview(review) {
  const { title, category, overview } = review
  if (!overview?.steps?.length || overview.steps.length > 8) throw new Error(`Unsupported overview for ${review.id}`)
  const color = palettes[category]
  if (!color || title.length > 22 || overview.steps.some(step => !step.trim() || step.length > 22)) {
    throw new Error(`Review the labels for ${review.id} before generating its overview`)
  }
  const count = overview.steps.length
  const firstY = 252
  const gap = Math.min(75, 410 / Math.max(count - 1, 1))
  const lastY = firstY + (count - 1) * gap
  const steps = overview.steps.map((step, index) => {
    const y = firstY + index * gap
    return `<g>
      <circle cx="104" cy="${y}" r="23" fill="${color.accent}"/>
      <text x="104" y="${y + 9}" text-anchor="middle" font-size="25" font-weight="700" fill="#fff">${index + 1}</text>
      <text x="154" y="${y + 10}" font-size="${step.length > 18 ? 29 : 33}" fill="${color.ink}">${escapeXml(step)}</text>
    </g>`
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}：步骤概览</title>
  <desc id="desc">${escapeXml(overview.steps.map((step, index) => `${index + 1}. ${step}`).join('；'))}。具体操作见项目正文。</desc>
  <rect width="960" height="720" fill="${color.paper}"/>
  <path d="M768 0H960V720H862C814 527 948 370 804 208Z" fill="${color.pale}" opacity=".38"/>
  <g font-family="sans-serif">
    <text x="80" y="78" font-size="24" font-weight="600" fill="${color.accent}">${escapeXml(category)} / 步骤概览</text>
    <text x="80" y="148" font-size="${title.length > 16 ? 39 : 46}" font-weight="700" fill="${color.ink}">${escapeXml(title)}</text>
    <path d="M80 191H880" stroke="${color.pale}" stroke-width="2"/>
    <path d="M104 ${firstY}V${lastY}" stroke="${color.pale}" stroke-width="7"/>
    ${steps}
  </g>
</svg>
`
}

export async function renderProjectOverviews({ check = false } = {}) {
  const reviews = JSON.parse(await readFile(resolve(root, 'lib/project/image-reviews.data.json'), 'utf8'))
  const targets = reviews.filter(review => review.overview)
  for (const review of targets) {
    const expectedPath = `/project-guides/overviews/project-${review.id}.svg`
    if (review.replacementCover !== expectedPath) throw new Error(`Unexpected overview path for ${review.id}`)
    const path = resolve(root, `public${expectedPath}`)
    const svg = renderProjectOverview(review)
    if (check) {
      if (await readFile(path, 'utf8') !== svg) throw new Error(`Stale overview: ${expectedPath}`)
    } else {
      await mkdir(resolve(root, 'public/project-guides/overviews'), { recursive: true })
      await writeFile(path, svg)
    }
  }
  return targets.length
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const unknown = process.argv.slice(2).filter(arg => arg !== '--check')
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`)
  const check = process.argv.includes('--check')
  const count = await renderProjectOverviews({ check })
  console.log(`${check ? 'Verified' : 'Rendered'} ${count} project overviews; no database or network operations.`)
}

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// Import reviewed source photos/diagrams. This script never generates images,
// fetches a remote resource, writes the database, or publishes an application.
const root = process.cwd()
const registryPath = path.join(root, 'lib/project/source-tutorials.data.json')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const readJson = async file => JSON.parse(await readFile(file, 'utf8'))

async function main() {
  const [baselineFile, proposalsFile] = process.argv.slice(2)
  if (!baselineFile || !proposalsFile) throw new Error('Usage: node scripts/import-project-source-tutorials.mjs <baseline.json> <reviewed-proposals.json>')
  const [baseline, proposals, reviews, demonstrations] = await Promise.all([
    readJson(baselineFile), readJson(proposalsFile),
    readJson('lib/project/image-reviews.data.json'),
    readJson('lib/project/demonstration-images.data.json'),
  ])
  const entries = new Map()
  const seen = new Set()
  for (const proposal of proposals) {
    const original = baseline.find(project => project.id === proposal.id)
    if (!original || !Number.isSafeInteger(proposal.id) || proposal.id <= 0 || seen.has(proposal.id)) throw new Error(`Invalid or repeated project: ${proposal.id}`)
    seen.add(proposal.id)
    if (proposal.verdict !== 'accepted') throw new Error(`${proposal.id}: visual review required`)
    if (original.videoUrl || !proposal.source?.url?.startsWith('https://') || !proposal.source.title || !proposal.source.publisher) throw new Error(`${proposal.id}: incomplete source`)
    if (!proposal.description || !proposal.reflection || !proposal.materials?.length || !proposal.steps?.length || !proposal.images?.length) throw new Error(`${proposal.id}: incomplete tutorial`)
    const version = proposal.version ?? 'v1'
    if (!/^v\d+$/.test(version)) throw new Error('Version must be v followed by a number')
    const assetDir = path.join(root, `public/project-guides/sources/project-${proposal.id}`)
    await mkdir(assetDir, { recursive: true })
    const assets = []
    for (const [index, image] of proposal.images.entries()) {
      if (!image.sourcePath || !image.sourceImageUrl?.startsWith('https://')) throw new Error(`${proposal.id}: missing original image ${index}`)
      const bytes = await readFile(image.sourcePath)
      const metadata = await sharp(bytes).metadata()
      const crop = image.crop ?? { left: 0, top: 0, width: metadata.width, height: metadata.height }
      if (!['left', 'top', 'width', 'height'].every(key => Number.isSafeInteger(crop[key])) || crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1 || crop.left + crop.width > metadata.width || crop.top + crop.height > metadata.height) throw new Error(`${proposal.id}: invalid crop ${index}`)
      const encoded = await sharp(bytes).extract(crop).webp({ quality: 92 }).toBuffer()
      const filename = `image-${index + 1}-${version}.webp`
      await writeFile(path.join(assetDir, filename), encoded)
      assets.push({
        image: `/project-guides/sources/project-${proposal.id}/${filename}`,
        sourceImageUrl: image.sourceImageUrl,
        sourcePageUrl: proposal.source.url,
        crop: { ...crop, sourceWidth: metadata.width, sourceHeight: metadata.height },
        kind: image.kind ?? 'photo', sha256: hash(encoded), sourceSha256: hash(bytes),
        notes: image.notes ?? [],
      })
    }
    const cover = assets[proposal.coverImageIndex ?? 0]
    if (!cover) throw new Error(`${proposal.id}: invalid cover index`)
    const steps = proposal.steps.map(step => {
      if (!step.title || !step.description) throw new Error(`${proposal.id}: incomplete step`)
      if (step.imageIndex !== undefined && !assets[step.imageIndex]) throw new Error(`${proposal.id}: invalid step image index`)
      return { title: step.title, description: step.description, ...(step.imageIndex !== undefined ? { image_url: assets[step.imageIndex].image } : {}) }
    })
    const review = reviews.find(item => item.id === proposal.id)
    const demonstration = demonstrations.find(item => item.id === proposal.id)
    entries.set(proposal.id, {
      id: original.id, title: original.title, category: original.category,
      baseline: {
        description: original.description, materials: original.materials,
        steps: original.steps.map(({ title, description }) => ({ title, description })),
        covers: [...new Set([original.image, ...review?.covers ?? [], review?.replacementCover, demonstration?.image, demonstration?.sourceImage].filter(Boolean))],
      },
      source: proposal.source,
      ...(proposal.downloads?.length ? { downloads: proposal.downloads } : {}),
      replacement: { description: proposal.description, materials: proposal.materials, steps, reflection: proposal.reflection, image: cover.image },
      assets,
    })
    process.stdout.write(`${proposal.id}: ${assets.length} source images imported\n`)
  }
  // Merge only this batch into the latest registry so another editor's work on
  // a different project is retained while image encoding is in progress.
  const latest = new Map((await readJson(registryPath)).map(entry => [entry.id, entry]))
  for (const [id, entry] of entries) latest.set(id, entry)
  const temporary = `${registryPath}.tmp`
  await writeFile(temporary, `${JSON.stringify([...latest.values()].sort((a, b) => a.id - b.id), null, 2)}\n`)
  await rename(temporary, registryPath)
}

await main()

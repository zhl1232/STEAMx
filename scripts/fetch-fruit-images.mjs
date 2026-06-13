#!/usr/bin/env node
/**
 * Fetch fruit/nut species images focused on edible produce (fruit, nut, seed),
 * not whole trees or foliage.
 *
 * Source priority:
 *   1. iNaturalist observations annotated as Plant Phenology → Fruiting
 *   2. Wikimedia Commons searches with fruit/nut/seed keywords
 *   3. Wikidata P18 only when the Commons filename looks produce-related
 *
 * Usage:
 *   node scripts/fetch-fruit-images.mjs
 *   node scripts/fetch-fruit-images.mjs --limit=5 --per-species=3 --force
 *   node scripts/fetch-fruit-images.mjs --only=fragaria-ananassa,malus-pumila --force
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compressSpeciesImageFile } from './lib/compress-species-image.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const INPUT_PATH = path.join(ROOT, 'fruits.json')
const OUTPUT_DIR = path.join(ROOT, 'public', 'fruits', 'images')
const MANIFEST_PATH = path.join(ROOT, 'public', 'fruits', 'media-manifest.json')

const INAT_API = 'https://api.inaturalist.org/v1'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const HEADERS = {
  'User-Agent': 'steam-explore-fruit-media/2.0 (research; local-project)',
  Accept: 'application/json',
}

/** iNaturalist controlled term: Plant Phenology → Fruiting */
const INAT_PHENOLOGY_TERM_ID = 12
const INAT_FRUITING_VALUE_ID = 14

const PRODUCE_KEYWORDS = [
  'fruit', 'fruits', 'berry', 'berries', 'nut', 'nuts', 'seed', 'seeds',
  'produce', 'harvest', 'crop', 'flesh', 'pulp', 'drupe', 'achene',
  '果', '果实', '坚果', '种子',
]

const TREE_KEYWORDS = [
  'tree', 'trees', 'forest', 'woodland', 'leaf', 'leaves', 'foliage',
  'branch', 'branches', 'bark', 'habitat', 'landscape', 'plantation',
  'grove', 'orchard row', 'canopy', 'trunk',
  '树', '叶', '林',
]

function parseArgs() {
  const args = { limit: null, only: null, perSpecies: 3, force: false, delayMs: 400 }
  for (const token of process.argv.slice(2)) {
    if (token.startsWith('--limit=')) args.limit = Number(token.split('=')[1]) || null
    else if (token.startsWith('--only=')) {
      args.only = new Set(token.split('=')[1].split(',').map((slug) => slug.trim()).filter(Boolean))
    } else if (token.startsWith('--per-species=')) args.perSpecies = Number(token.split('=')[1]) || 3
    else if (token === '--force') args.force = true
    else if (token.startsWith('--delay-ms=')) args.delayMs = Number(token.split('=')[1]) || 400
  }
  return args
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url, retries = 3) {
  let lastError
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS })
      if (response.status === 429) {
        await sleep(12000 * (i + 1))
        lastError = new Error('HTTP 429')
        continue
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      await sleep(1000 * (i + 1))
    }
  }
  throw lastError
}

async function downloadFile(url, outputPath, retries = 3) {
  let lastError
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!isSupportedImageBuffer(buffer)) {
        throw new Error('downloaded file is not a supported image')
      }
      await fs.writeFile(outputPath, buffer)
      return
    } catch (error) {
      lastError = error
      await sleep(1000 * (i + 1))
    }
  }
  throw lastError
}

function isSupportedImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true
  if (buffer.slice(0, 8).toString('ascii') === '\x89PNG\r\n\x1a\n') return true
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return true
  return false
}

function simplifyName(name) {
  return name
    .replace(/\s*'[^']*'$/g, '')
    .replace(/\s*"[^"]*"$/g, '')
    .replace(/\s+(var\.|subsp\.|f\.)\s+\S+/g, '')
    .replace(/\s+spp\.$/i, '')
    .trim()
}

function getCultivarNames(name) {
  return Array.from(name.matchAll(/['"]([^'"]+)['"]/g), (match) => match[1].trim())
}

function getKnownSearchAliases(item) {
  const haystack = [item.slug, item.common_name, item.scientific_name, ...(item.aliases || [])].join(' ')
  const aliases = []

  if (/shiranui|丑橘|丑柑|不知火/i.test(haystack)) {
    aliases.push('Shiranui citrus', 'Dekopon', 'Shiranuhi')
  }
  if (/harumi|春见|耙耙柑/i.test(haystack)) {
    aliases.push('Harumi citrus')
  }

  return aliases
}

function isPrimarilyNut(item) {
  if (item.plant_uses?.includes('nut')) return true
  return /nut|pine|walnut|hazel|almond|pistach|cashew|macadamia|sunflower|peanut|ginkgo|castanea|carya|corylus|pistacia|helianthus|arachis|trichosanthes|cucurbita/i.test(item.slug)
}

function buildTaxonSearchTerms(item) {
  const cultivarTerms = getCultivarNames(item.scientific_name || '')
    .flatMap((name) => [name, `${name} citrus`])

  return Array.from(new Set([
    item.scientific_name,
    simplifyName(item.scientific_name || ''),
    ...cultivarTerms,
    item.common_name,
    ...(item.aliases || []),
    ...getKnownSearchAliases(item),
  ].filter(Boolean)))
}

function buildProduceSearchQueries(item) {
  const isNut = isPrimarilyNut(item)
  const produceWord = isNut ? 'nut' : 'fruit'
  const produceWords = isNut ? ['nut', 'nuts', 'seed', 'seeds'] : ['fruit', 'fruits', 'produce']
  const taxonTerms = buildTaxonSearchTerms(item)
  const queries = new Set()

  for (const term of taxonTerms) {
    for (const word of produceWords) {
      queries.add(`${term} ${word}`)
    }
  }

  for (const alias of item.aliases || []) {
    queries.add(`${alias} ${produceWord}`)
  }

  if (item.common_name) {
    queries.add(`${item.common_name} ${produceWord}`)
  }

  return Array.from(queries)
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ')
}

function scoreProduceTitle(title, isNut) {
  const normalized = normalizeTitle(title)
  let score = 0

  for (const keyword of PRODUCE_KEYWORDS) {
    if (normalized.includes(keyword)) score += 3
  }

  for (const keyword of TREE_KEYWORDS) {
    if (normalized.includes(keyword)) score -= 4
  }

  if (isNut && /\bnut(s)?\b/.test(normalized)) score += 2
  if (!isNut && /\bfruit(s)?\b/.test(normalized)) score += 2

  return score
}

function isProduceLikeTitle(title, isNut) {
  return scoreProduceTitle(title, isNut) > 0
}

async function resolveInatTaxon(searchTerms) {
  const names = Array.from(new Set(searchTerms.flatMap((term) => [term, simplifyName(term)]).filter(Boolean)))

  for (const name of names) {
    const taxaData = await fetchJson(
      `${INAT_API}/taxa?q=${encodeURIComponent(name)}&rank=species,variety,hybrid,subspecies,genus&per_page=5`,
    )
    const taxa = taxaData?.results || []
    const taxon = taxa.find((item) => item.name?.toLowerCase() === name.toLowerCase()) || taxa[0]
    if (taxon) return taxon
  }

  return null
}

async function getInatFruitingImages(searchTerms, maxCount) {
  const taxon = await resolveInatTaxon(searchTerms)
  if (!taxon) return []

  const observationsData = await fetchJson(
    `${INAT_API}/observations?taxon_id=${taxon.id}&photos=true&quality_grade=research&per_page=${Math.max(maxCount * 3, 12)}&order_by=votes&term_id=${INAT_PHENOLOGY_TERM_ID}&term_value_id=${INAT_FRUITING_VALUE_ID}`,
  )
  const observations = observationsData?.results || []
  const urls = []

  for (const observation of observations) {
    for (const photo of observation.photos || []) {
      if (urls.length >= maxCount) break
      const url = (photo.url || '').replace('/square.', '/medium.')
      if (url) {
        urls.push({
          url,
          license: photo.license_code,
          attribution: photo.attribution,
          source: 'inaturalist-fruiting',
        })
      }
    }
    if (urls.length >= maxCount) break
  }

  return urls.slice(0, maxCount)
}

async function getCommonsSearchImages(searchTerm, maxCount, isNut) {
  const data = await fetchJson(
    `${COMMONS_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrnamespace=6&gsrlimit=${maxCount * 4}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`,
  )
  const pages = Object.values(data?.query?.pages || {})
  const ranked = pages
    .map((page) => {
      const info = page?.imageinfo?.[0]
      if (!info?.url || !info.mime?.startsWith('image/')) return null
      return {
        url: info.url,
        license: 'Wikimedia Commons',
        attribution: null,
        source: 'wikimedia-commons',
        title: page.title || '',
        score: scoreProduceTitle(page.title || '', isNut),
      }
    })
    .filter(Boolean)
    .filter((image) => image.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked.slice(0, maxCount)
}

async function getWikimediaProduceImages(item, maxCount) {
  const isNut = isPrimarilyNut(item)
  const queries = buildProduceSearchQueries(item)
  const urls = []
  const seen = new Set()

  function addImage(image) {
    if (!image?.url || seen.has(image.url)) return
    seen.add(image.url)
    urls.push(image)
  }

  for (const query of queries) {
    const commonsImages = await getCommonsSearchImages(query, maxCount - urls.length, isNut)
    for (const image of commonsImages) addImage(image)
    if (urls.length >= maxCount) return urls.slice(0, maxCount)
  }

  const taxonTerms = buildTaxonSearchTerms(item)
  for (const name of taxonTerms) {
    const searchData = await fetchJson(
      `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=3&format=json&origin=*`,
    )
    const hit = (searchData?.search || []).find(
      (entity) => entity.label?.toLowerCase() === name.toLowerCase(),
    ) || searchData?.search?.[0]
    if (!hit) continue

    const entityData = await fetchJson(
      `${WIKIDATA_API}?action=wbgetentities&ids=${hit.id}&props=claims&format=json&origin=*`,
    )
    const entity = entityData?.entities?.[hit.id]
    const fileName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!fileName || !isProduceLikeTitle(fileName, isNut)) continue

    const fileInfoData = await fetchJson(
      `${COMMONS_API}?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`,
    )
    const pages = fileInfoData?.query?.pages || {}
    const info = Object.values(pages)[0]?.imageinfo?.[0]
    if (info?.url) {
      addImage({
        url: info.url,
        license: 'Wikimedia Commons',
        attribution: null,
        source: 'wikidata-p18',
        title: fileName,
      })
    }
    if (urls.length >= maxCount) return urls.slice(0, maxCount)
  }

  return urls.slice(0, maxCount)
}

async function collectProduceImages(item, maxCount) {
  const searchTerms = buildTaxonSearchTerms(item)
  const sources = []
  const seen = new Set()

  function addBatch(batch) {
    for (const image of batch) {
      if (!image?.url || seen.has(image.url)) continue
      seen.add(image.url)
      sources.push(image)
      if (sources.length >= maxCount) break
    }
  }

  addBatch(await getInatFruitingImages(searchTerms, maxCount))
  if (sources.length < maxCount) {
    addBatch(await getWikimediaProduceImages(item, maxCount - sources.length))
  }

  return sources.slice(0, maxCount)
}

async function loadSpecies() {
  const raw = await fs.readFile(INPUT_PATH, 'utf8')
  return JSON.parse(raw)
}

async function fileExists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false)
}

let sharpModulePromise = null

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').catch(() => null)
  }
  return sharpModulePromise
}

async function optimizeDownloadedImage(outputPath) {
  const sharp = await getSharp()
  if (!sharp?.default) return
  await compressSpeciesImageFile(outputPath, sharp)
}

async function main() {
  const args = parseArgs()
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const allSpecies = await loadSpecies()
  const selectedSpecies = args.only
    ? allSpecies.filter((item) => args.only.has(item.slug))
    : allSpecies
  const species = args.limit ? selectedSpecies.slice(0, args.limit) : selectedSpecies
  const results = []

  console.log(`Loaded ${allSpecies.length} fruit species, processing ${species.length}`)
  console.log(`Target: ${args.perSpecies} produce-focused images per species\n`)

  for (let i = 0; i < species.length; i += 1) {
    const item = species[i]
    if (!item.slug || !item.scientific_name) continue

    process.stdout.write(`[${i + 1}/${species.length}] ${item.slug} (${item.scientific_name}) ... `)

    if (!args.force) {
      const existingFiles = []
      for (let n = 1; n <= args.perSpecies; n += 1) {
        const filename = `${item.slug}-${n}.jpg`
        if (await fileExists(path.join(OUTPUT_DIR, filename))) existingFiles.push(filename)
      }
      if (existingFiles.length >= args.perSpecies) {
        results.push({
          slug: item.slug,
          scientificName: item.scientific_name,
          images: existingFiles,
          status: 'exists',
        })
        console.log(`exists(${existingFiles.length})`)
        continue
      }
    }

    try {
      const imageSources = await collectProduceImages(item, args.perSpecies)
      const downloaded = []

      for (let n = 0; n < Math.min(imageSources.length, args.perSpecies); n += 1) {
        const filename = `${item.slug}-${n + 1}.jpg`
        const outputPath = path.join(OUTPUT_DIR, filename)
        if (!args.force && await fileExists(outputPath)) {
          downloaded.push(filename)
          continue
        }
        try {
          await downloadFile(imageSources[n].url, outputPath)
          await optimizeDownloadedImage(outputPath)
          downloaded.push(filename)
        } catch {
          // Skip broken individual image URLs.
        }
        await sleep(200)
      }

      results.push({
        slug: item.slug,
        scientificName: item.scientific_name,
        images: downloaded,
        status: downloaded.length ? 'downloaded' : 'not_found',
        sources: imageSources.map((image) => image.source),
      })
      console.log(`${downloaded.length} images`)
    } catch (error) {
      results.push({
        slug: item.slug,
        scientificName: item.scientific_name,
        images: [],
        status: 'error',
        error: error.message,
      })
      console.log(`error: ${error.message}`)
    }

    await sleep(args.delayMs)
  }

  const summary = {
    total: results.length,
    downloaded: results.filter((item) => item.status === 'downloaded').length,
    exists: results.filter((item) => item.status === 'exists').length,
    notFound: results.filter((item) => item.status === 'not_found').length,
    error: results.filter((item) => item.status === 'error').length,
    totalImages: results.reduce((sum, item) => sum + item.images.length, 0),
  }
  await fs.writeFile(
    MANIFEST_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), perSpecies: args.perSpecies, strategy: 'produce-focused', summary, results }, null, 2)}\n`,
  )

  console.log(`\nDone! Manifest: public/fruits/media-manifest.json`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

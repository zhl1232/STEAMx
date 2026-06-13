#!/usr/bin/env node
/**
 * Fetch fruit/nut species images from iNaturalist + Wikimedia Commons.
 *
 * Usage:
 *   node scripts/fetch-fruit-images.mjs
 *   node scripts/fetch-fruit-images.mjs --limit=5 --per-species=3 --force
 *   node scripts/fetch-fruit-images.mjs --only=citrus-harumi-shiranui --force
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const INPUT_PATH = path.join(ROOT, 'fruits.json')
const OUTPUT_DIR = path.join(ROOT, 'public', 'fruits', 'images')
const MANIFEST_PATH = path.join(ROOT, 'public', 'fruits', 'media-manifest.json')

const INAT_API = 'https://api.inaturalist.org/v1'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const HEADERS = {
  'User-Agent': 'steam-explore-fruit-media/1.0 (research; local-project)',
  Accept: 'application/json',
}

function parseArgs() {
  const args = { limit: null, only: null, perSpecies: 3, force: false, delayMs: 400 }
  for (const token of process.argv.slice(2)) {
    if (token.startsWith('--limit=')) args.limit = Number(token.split('=')[1]) || null
    else if (token.startsWith('--only=')) args.only = new Set(token.split('=')[1].split(',').map((slug) => slug.trim()).filter(Boolean))
    else if (token.startsWith('--per-species=')) args.perSpecies = Number(token.split('=')[1]) || 3
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
      await fs.writeFile(outputPath, buffer)
      return
    } catch (error) {
      lastError = error
      await sleep(1000 * (i + 1))
    }
  }
  throw lastError
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

function buildSearchTerms(item) {
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

async function getInatImages(searchTerms, maxCount) {
  const names = Array.from(new Set(searchTerms.flatMap((term) => [term, simplifyName(term)]).filter(Boolean)))
  let taxon = null

  for (const name of names) {
    const taxaData = await fetchJson(
      `${INAT_API}/taxa?q=${encodeURIComponent(name)}&rank=species,variety,hybrid,subspecies,genus&per_page=5`,
    )
    const taxa = taxaData?.results || []
    taxon = taxa.find((item) => item.name?.toLowerCase() === name.toLowerCase()) || taxa[0]
    if (taxon) break
  }
  if (!taxon) return []

  const observationsData = await fetchJson(
    `${INAT_API}/observations?taxon_id=${taxon.id}&photos=true&quality_grade=research&per_page=${maxCount}&order_by=votes`,
  )
  const observations = observationsData?.results || []
  const urls = []

  for (const observation of observations) {
    for (const photo of observation.photos || []) {
      if (urls.length >= maxCount) break
      const url = (photo.url || '').replace('/square.', '/medium.')
      if (url) urls.push({ url, license: photo.license_code, attribution: photo.attribution })
    }
    if (urls.length >= maxCount) break
  }

  return urls.slice(0, maxCount)
}

async function getCommonsSearchImages(searchTerm, maxCount) {
  const data = await fetchJson(
    `${COMMONS_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrnamespace=6&gsrlimit=${maxCount * 2}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`,
  )
  const pages = Object.values(data?.query?.pages || {})
  const images = []

  for (const page of pages) {
    const info = page?.imageinfo?.[0]
    if (!info?.url || !info.mime?.startsWith('image/')) continue
    images.push({ url: info.url, license: 'Wikimedia Commons', attribution: null })
    if (images.length >= maxCount) break
  }

  return images
}

async function getWikimediaImages(searchTerms, maxCount) {
  const names = Array.from(new Set(searchTerms.flatMap((term) => [term, simplifyName(term)]).filter(Boolean)))
  const urls = []
  const seen = new Set()

  function addImage(image) {
    if (!image?.url || seen.has(image.url)) return
    seen.add(image.url)
    urls.push(image)
  }

  for (const name of names) {
    const searchData = await fetchJson(
      `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=3&format=json&origin=*`,
    )
    const hit = (searchData?.search || []).find(
      (item) => item.label?.toLowerCase() === name.toLowerCase(),
    ) || searchData?.search?.[0]
    if (!hit) continue

    const entityData = await fetchJson(
      `${WIKIDATA_API}?action=wbgetentities&ids=${hit.id}&props=claims&format=json&origin=*`,
    )
    const entity = entityData?.entities?.[hit.id]
    const fileName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!fileName) continue

    const fileInfoData = await fetchJson(
      `${COMMONS_API}?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`,
    )
    const pages = fileInfoData?.query?.pages || {}
    const info = Object.values(pages)[0]?.imageinfo?.[0]
    if (info?.url) addImage({ url: info.url, license: 'Wikimedia Commons', attribution: null })
    if (urls.length >= maxCount) return urls.slice(0, maxCount)
  }

  for (const name of names) {
    const commonsImages = await getCommonsSearchImages(name, maxCount - urls.length)
    for (const image of commonsImages) addImage(image)
    if (urls.length >= maxCount) break
  }

  return urls.slice(0, maxCount)
}

async function loadSpecies() {
  const raw = await fs.readFile(INPUT_PATH, 'utf8')
  return JSON.parse(raw)
}

async function fileExists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false)
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
  console.log(`Target: ${args.perSpecies} images per species\n`)

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
        results.push({ slug: item.slug, scientificName: item.scientific_name, images: existingFiles, status: 'exists' })
        console.log(`exists(${existingFiles.length})`)
        continue
      }
    }

    try {
      const searchTerms = buildSearchTerms(item)
      const inatImages = await getInatImages(searchTerms, args.perSpecies)
      const imageSources = [...inatImages]
      if (imageSources.length < args.perSpecies) {
        const wikiImages = await getWikimediaImages(searchTerms, args.perSpecies - imageSources.length)
        imageSources.push(...wikiImages)
      }

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
      })
      console.log(`${downloaded.length} images`)
    } catch (error) {
      results.push({ slug: item.slug, scientificName: item.scientific_name, images: [], status: 'error', error: error.message })
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
  await fs.writeFile(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), perSpecies: args.perSpecies, summary, results }, null, 2) + '\n')

  console.log(`\nDone! Manifest: public/fruits/media-manifest.json`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

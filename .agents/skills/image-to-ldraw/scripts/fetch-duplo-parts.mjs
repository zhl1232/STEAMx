#!/usr/bin/env node
/**
 * fetch-duplo-parts.mjs
 *
 * Downloads the official LDraw complete library, scans all .dat files,
 * and extracts an index of Duplo parts with basic header metadata.
 *
 * Usage:
 *   node scripts/fetch-duplo-parts.mjs [--cache-dir <dir>] [--output <file>]
 *
 * Output: duplo-parts-index.json with all discovered Duplo parts.
 */
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, writeFile, stat, rm } from 'node:fs/promises'
import { dirname, resolve, join, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createInterface } from 'node:readline'

const execFileAsync = promisify(execFile)
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SKILL_ROOT = resolve(SCRIPT_DIR, '..')

const COMPLETE_ZIP_URL = 'https://library.ldraw.org/library/updates/complete.zip'
const UNOFFICIAL_ZIP_URL = 'https://library.ldraw.org/library/unofficial/ldrawunf.zip'

function parseArgs(argv) {
  const args = {
    cacheDir: resolve(SKILL_ROOT, '.cache/ldraw-library'),
    output: resolve(SKILL_ROOT, 'references/duplo-parts-index.json'),
    skipDownload: false,
    includeUnofficial: true,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cache-dir' && argv[i + 1]) args.cacheDir = resolve(argv[++i])
    else if (argv[i] === '--output' && argv[i + 1]) args.output = resolve(argv[++i])
    else if (argv[i] === '--skip-download') args.skipDownload = true
    else if (argv[i] === '--no-unofficial') args.includeUnofficial = false
  }
  return args
}

async function downloadFile(url, destPath) {
  console.log(`Downloading ${url} ...`)
  await mkdir(dirname(destPath), { recursive: true })
  await execFileAsync('curl', ['-sSL', '-o', destPath, '--max-time', '300', url], {
    maxBuffer: 16 * 1024 * 1024,
  })
  const info = await stat(destPath)
  console.log(`  → ${(info.size / 1024 / 1024).toFixed(1)} MB`)
}

async function extractZip(zipPath, destDir) {
  console.log(`Extracting ${basename(zipPath)} to ${destDir} ...`)
  await mkdir(destDir, { recursive: true })
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir], {
    maxBuffer: 64 * 1024 * 1024,
  })
}

async function fileExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Recursively walk a directory and yield file paths matching a filter.
 */
async function* walkDir(dir, filter) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkDir(fullPath, filter)
    } else if (!filter || filter(entry.name)) {
      yield fullPath
    }
  }
}

/**
 * Parse the header of a .dat file to extract metadata.
 * LDraw .dat header format:
 *   Line 1: 0 <description>
 *   0 Name: <filename>
 *   0 Author: <author>
 *   0 !LDRAW_ORG <type> <status>
 *   0 !CATEGORY <category>
 *   0 !KEYWORDS <keywords>
 */
function parseDatHeader(content, filePath) {
  const lines = content.split(/\r?\n/)
  const result = {
    fileName: basename(filePath),
    filePath,
    description: '',
    name: '',
    author: '',
    ldrawOrg: '',
    category: '',
    keywords: [],
    isDuplo: false,
    duploMatchReason: '',
  }

  // First line should be "0 <description>"
  if (lines[0]?.startsWith('0 ')) {
    result.description = lines[0].slice(2).trim()
  }

  // Parse remaining header lines (stop at first non-comment or geometry line)
  for (let i = 1; i < Math.min(lines.length, 50); i++) {
    const line = lines[i].trim()
    if (!line.startsWith('0 ') && line !== '0') {
      // Non-comment line found, stop header parsing
      if (line.length > 0 && !line.startsWith('0')) break
      continue
    }

    const rest = line.slice(2).trim()

    if (rest.startsWith('Name:')) {
      result.name = rest.slice(5).trim()
    } else if (rest.startsWith('Author:')) {
      result.author = rest.slice(7).trim()
    } else if (rest.startsWith('!LDRAW_ORG')) {
      result.ldrawOrg = rest.slice(10).trim()
    } else if (rest.startsWith('!CATEGORY')) {
      result.category = rest.slice(9).trim()
    } else if (rest.startsWith('!KEYWORDS')) {
      const kw = rest.slice(9).trim()
      result.keywords.push(...kw.split(',').map((k) => k.trim()).filter(Boolean))
    }
  }

  // Determine if this is a Duplo part
  const descLower = result.description.toLowerCase()
  const catLower = result.category.toLowerCase()
  const kwLower = result.keywords.join(' ').toLowerCase()

  if (catLower === 'duplo') {
    result.isDuplo = true
    result.duploMatchReason = 'category'
  } else if (descLower.includes('duplo')) {
    result.isDuplo = true
    result.duploMatchReason = 'description'
  } else if (kwLower.includes('duplo')) {
    result.isDuplo = true
    result.duploMatchReason = 'keywords'
  }

  return result
}

/**
 * Parse basic geometry info from .dat content:
 * - bounding box from type 1 (sub-file references), type 3 (triangles), type 4 (quads) lines
 * - stud footprint from description
 */
function parseBasicGeometry(content, headerInfo) {
  const footprint = parseStudFootprint(headerInfo.description)

  return {
    studFootprint: footprint,
  }
}

/**
 * Extract stud footprint from description like "Duplo Brick 2 x 4"
 */
function parseStudFootprint(description) {
  // Match patterns like "2 x 3", "2 x 4 x 2", "8 x 8"
  const match = description.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/)
  if (!match) return null

  const dims = [parseInt(match[1]), parseInt(match[2])]
  if (match[3]) dims.push(parseInt(match[3]))

  // LDraw convention: x dimension is the larger, z is the smaller (for 2D footprint)
  // For "2 x 4", x=4, z=2
  return {
    x: Math.max(dims[0], dims[1]),
    z: Math.min(dims[0], dims[1]),
    height: dims[2] ?? null,
  }
}

/**
 * Classify part by description
 */
function classifyPart(description) {
  const d = description.toLowerCase()
  if (d.includes('plate')) return 'plate'
  if (d.includes('brick')) return 'brick'
  if (d.includes('slope')) return 'slope'
  if (d.includes('arch')) return 'arch'
  if (d.includes('tube')) return 'tube'
  if (d.includes('car base') || d.includes('vehicle')) return 'vehicle-base'
  if (d.includes('fence') || d.includes('railing')) return 'fence'
  if (d.includes('window') || d.includes('door')) return 'window-door'
  if (d.includes('roof')) return 'roof'
  if (d.includes('flower') || d.includes('tree') || d.includes('plant')) return 'plant'
  if (d.includes('figure') || d.includes('animal') || d.includes('head') || d.includes('body') || d.includes('leg')) return 'figure'
  if (d.includes('wheel') || d.includes('tyre') || d.includes('tire')) return 'wheel'
  if (d.includes('container') || d.includes('bucket') || d.includes('box')) return 'container'
  if (d.includes('slide') || d.includes('ramp')) return 'slide'
  return 'other'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const completeZipPath = join(args.cacheDir, 'complete.zip')
  const unofficialZipPath = join(args.cacheDir, 'ldrawunf.zip')
  const extractDir = join(args.cacheDir, 'extracted')

  // Step 1: Download
  if (!args.skipDownload) {
    if (!(await fileExists(completeZipPath))) {
      await downloadFile(COMPLETE_ZIP_URL, completeZipPath)
    } else {
      console.log('complete.zip already cached, skipping download (use --force to re-download)')
    }

    if (args.includeUnofficial && !(await fileExists(unofficialZipPath))) {
      await downloadFile(UNOFFICIAL_ZIP_URL, unofficialZipPath)
    }
  }

  // Step 2: Extract
  if (!(await fileExists(extractDir))) {
    await extractZip(completeZipPath, extractDir)
    if (args.includeUnofficial && await fileExists(unofficialZipPath)) {
      await extractZip(unofficialZipPath, extractDir)
    }
  } else {
    console.log('Already extracted, skipping (delete .cache/ldraw-library/extracted to re-extract)')
  }

  // Step 3: Scan for .dat files in parts/ directory
  console.log('Scanning for Duplo parts...')
  const partsDir = join(extractDir, 'ldraw', 'parts')
  const unofficialPartsDir = join(extractDir, 'ldraw', 'unofficial', 'parts')

  const allParts = []
  const scanDirs = [
    { dir: partsDir, source: 'official' },
  ]
  if (args.includeUnofficial && await fileExists(unofficialPartsDir)) {
    scanDirs.push({ dir: unofficialPartsDir, source: 'unofficial' })
  }

  let totalScanned = 0

  for (const { dir, source } of scanDirs) {
    if (!(await fileExists(dir))) {
      console.log(`  Skipping ${source} (dir not found: ${dir})`)
      continue
    }
    console.log(`  Scanning ${source}: ${dir}`)

    for await (const filePath of walkDir(dir, (name) => name.endsWith('.dat'))) {
      totalScanned++
      if (totalScanned % 500 === 0) {
        process.stderr.write(`  Scanned ${totalScanned} files...\r`)
      }

      try {
        const content = await readFile(filePath, 'utf8')
        const header = parseDatHeader(content, filePath)

        if (header.isDuplo) {
          const geometry = parseBasicGeometry(content, header)
          const category = classifyPart(header.description)

          allParts.push({
            partId: header.name || header.fileName,
            description: header.description,
            category,
            ldrawCategory: header.category,
            ldrawOrg: header.ldrawOrg,
            source,
            studFootprint: geometry.studFootprint,
            duploMatchReason: header.duploMatchReason,
            keywords: header.keywords,
          })
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
  }

  console.log(`\nScanned ${totalScanned} .dat files total`)
  console.log(`Found ${allParts.length} Duplo parts`)

  // Step 4: Sort and deduplicate
  allParts.sort((a, b) => a.partId.localeCompare(b.partId))

  // Group by category for summary
  const byCat = {}
  for (const p of allParts) {
    byCat[p.category] = (byCat[p.category] || 0) + 1
  }

  const index = {
    generatedAt: new Date().toISOString(),
    totalScanned,
    duploPartsFound: allParts.length,
    categoryBreakdown: byCat,
    parts: allParts,
  }

  // Step 5: Write output
  await mkdir(dirname(args.output), { recursive: true })
  await writeFile(args.output, JSON.stringify(index, null, 2) + '\n', 'utf8')
  console.log(`\nOutput written to: ${args.output}`)

  // Print summary
  console.log('\n=== Category Breakdown ===')
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`)
  }

  // Print first few parts as preview
  console.log('\n=== Sample Parts (first 10) ===')
  for (const p of allParts.slice(0, 10)) {
    const fp = p.studFootprint ? `${p.studFootprint.x}x${p.studFootprint.z}` : '?'
    console.log(`  ${p.partId.padEnd(15)} ${fp.padEnd(6)} ${p.description}`)
  }
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})

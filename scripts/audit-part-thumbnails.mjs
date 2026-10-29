/**
 * Audit every local model and its displayed part colours without changing assets.
 * Run from the repository root:
 *   node scripts/audit-part-thumbnails.mjs
 *   node scripts/audit-part-thumbnails.mjs --output /tmp/pairs.json --missing-output /tmp/missing.json
 * Outputs use the input format of fetch-part-thumbnails.py. Missing images exit 1.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

function parseArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--help') {
      console.log('Usage: node scripts/audit-part-thumbnails.mjs [--output FILE] [--missing-output FILE]')
      return null
    }
    if (!['--output', '--missing-output'].includes(argument) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error(`Invalid argument: ${argument}; use --help for usage`)
    }
    options[argument.slice(2)] = args[++index]
  }
  return options
}

function hasImage(thumbnail, root) {
  if (typeof thumbnail?.src !== 'string' || !thumbnail.src.startsWith('/courses/part-thumbs/')) return false
  try {
    return statSync(path.join(root, 'public', thumbnail.src)).isFile()
  } catch {
    return false
  }
}

async function audit(options) {
  const root = process.cwd()
  const require = createRequire(path.join(root, 'package.json'))
  const vitestRequire = createRequire(require.resolve('vitest/package.json'))
  const { createServer } = await import(vitestRequire.resolve('vite'))
  const vite = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': root } },
  })
  try {
    const { parseLdrawColorTable, summarizePackedLdrawBom } = await vite.ssrLoadModule('/lib/utils/ldraw-bom.ts')
    const { prepareLessonBomForCourse, compareLessonMaterials, mergeKitInventories } = await vite.ssrLoadModule('/lib/courses/lesson-materials.ts')
    const { resolveLdrawPart, resolveLdrawColor } = await vite.ssrLoadModule('/lib/courses/ldraw-part-mapping.ts')
    const { KIT_CATALOG } = await vite.ssrLoadModule('/lib/courses/course-kit-config.ts')
    const { mergeLessonMaterialPreferences } = await vite.ssrLoadModule('/lib/courses/lesson-material-preferences.ts')
    const manifest = JSON.parse(readFileSync('lib/courses/part-thumbnails.json', 'utf8'))
    const inventories = JSON.parse(readFileSync('lib/courses/ldraw-kit-inventories.json', 'utf8'))
    const colors = parseLdrawColorTable(readFileSync('public/courses/ldraw/LDConfig.ldr', 'utf8'))
    const pairs = new Map()
    const counts = { models: 0, steps: 0, combinations: 0 }

    function add(entry, source) {
      const key = `${entry.partId}|${entry.colorCode}`
      const previous = pairs.get(key)
      if (previous) {
        if (source && !previous.models.includes(source)) previous.models.push(source)
        return
      }
      const mapping = resolveLdrawPart(entry.partId, entry.partDescription)
      pairs.set(key, {
        partId: entry.partId,
        colorCode: entry.colorCode,
        rbColor: resolveLdrawColor(entry.colorCode),
        // Inventory alternatives may differ in shape; they are not image aliases.
        candidates: [...new Set([
          entry.partId.replace(/\.dat$/, ''),
          ...mapping.partNums.filter((id) => !mapping.flags.shapeAlternatives?.[id]),
        ])],
        figure: !!mapping.flags.figureComponent,
        name: entry.partName,
        external: !!mapping.flags.externalMaterial,
        models: source ? [source] : [],
      })
    }

    const files = readdirSync('public/courses/ldraw').filter((file) => file.endsWith('.mpd')).sort()
    for (const file of files) {
      counts.models++
      const courseId = file.startsWith('3-') ? 5 : file.startsWith('4-') ? 6 : file.startsWith('5-') ? 7 : 0
      const rawBom = summarizePackedLdrawBom(readFileSync(`public/courses/ldraw/${file}`, 'utf8'), colors)
      const bom = prepareLessonBomForCourse(courseId, rawBom)
      counts.steps += bom.steps.length
      for (const entry of [...bom.entries, ...bom.steps.flatMap((step) => step.entries)]) add(entry, file)
      if (!courseId) continue

      // The list displays Toolo colours from the full-lesson allocation, also in step rows.
      for (let mask = 0; mask < 2 ** KIT_CATALOG.length; mask++) {
        const kits = KIT_CATALOG.filter((_, index) => mask & (2 ** index)).map((kit) => ({ setNum: kit.setNum, copies: 1 }))
        const preferences = mergeLessonMaterialPreferences(courseId, { kits })
        const result = compareLessonMaterials(bom, mergeKitInventories(preferences.kits), preferences)
        counts.combinations++
        for (const entry of result.entries) if (entry.mapping.flags.kitColor) add(entry, file)
      }

      // Higher kit counts can change the dominant allocation colour. Cover every compatible stock colour.
      for (const entry of bom.entries) {
        const mapping = resolveLdrawPart(entry.partId, entry.partDescription)
        if (!mapping.flags.kitColor) continue
        for (const kit of Object.values(inventories)) {
          for (const part of kit.parts) {
            if (mapping.partNums.includes(part.partNum)) add({ ...entry, colorCode: part.colorId }, file)
          }
        }
      }
    }

    const brokenKeys = Object.keys(manifest).filter((key) => !hasImage(manifest[key], root))
    // Keep broken legacy manifest entries repairable even if no local model currently uses them.
    for (const key of brokenKeys) {
      if (pairs.has(key)) continue
      const separator = key.lastIndexOf('|')
      const partId = key.slice(0, separator)
      const colorCode = Number(key.slice(separator + 1))
      if (separator < 1 || !Number.isSafeInteger(colorCode)) throw new Error(`Invalid manifest key: ${key}`)
      add({ partId, colorCode, partName: partId })
    }
    const all = [...pairs.values()]
    const missing = all.filter((pair) => !hasImage(manifest[`${pair.partId}|${pair.colorCode}`], root))
    if (options.output) writeFileSync(options.output, `${JSON.stringify(all, null, 2)}\n`)
    if (options['missing-output']) writeFileSync(options['missing-output'], `${JSON.stringify(missing, null, 2)}\n`)
    console.log(`Part thumbnails: ${counts.models} models, ${counts.steps} steps, ${counts.combinations} kit combinations; ${all.length} pairs, ${missing.length} missing, ${brokenKeys.length} broken manifest images.`)
    if (missing.length || brokenKeys.length) process.exitCode = 1
  } finally {
    await vite.close()
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options) await audit(options)
} catch (error) {
  console.error(`Part thumbnail audit failed: ${error.message}`)
  process.exitCode = 1
}

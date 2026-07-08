import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { loadPartMetadata, resolveAssembly } from './ldraw-common.mjs'

function mainModelText(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')
  const firstFileIndex = lines.findIndex((line) => line.trim().startsWith('0 FILE '))

  let mainLines
  if (firstFileIndex === 0) {
    const nextFileIndex = lines.findIndex((line, index) => index > 0 && line.trim().startsWith('0 FILE '))
    mainLines = lines.slice(1, nextFileIndex === -1 ? lines.length : nextFileIndex)
  } else if (firstFileIndex > 0) {
    mainLines = lines.slice(0, firstFileIndex)
  } else {
    mainLines = lines
  }

  while (mainLines.length > 0 && mainLines.at(-1)?.trim() === '0 NOFILE') mainLines.pop()
  return mainLines.join('\n')
}

function ldrToAssembly(ldrFile, text) {
  const slug = basename(ldrFile, '.ldr')
  const steps = []
  let placements = []
  let stepNumber = 1
  let lineNumber = 0
  const errors = []

  for (const rawLine of mainModelText(text).split(/\r?\n/)) {
    lineNumber += 1
    const line = rawLine.trim()

    if (/^0\s+STEP\b/i.test(line)) {
      steps.push({ step: stepNumber, placements })
      placements = []
      stepNumber += 1
      continue
    }

    if (!line.startsWith('1 ')) continue

    const tokens = line.split(/\s+/)
    if (tokens.length < 15) {
      errors.push(`line ${lineNumber}: invalid LDraw type-1 line`)
      continue
    }

    const colorCode = Number(tokens[1])
    const transform = tokens.slice(2, 14).map(Number)
    const partId = tokens.slice(14).join(' ')
    if (![colorCode, ...transform].every(Number.isFinite)) {
      errors.push(`line ${lineNumber}: non-numeric LDraw transform for ${partId}`)
      continue
    }

    placements.push({
      id: `${slug}_l${lineNumber}`,
      partId,
      colorCode,
      ldrawLine: line,
      support: {
        type: 'manual',
        reason: 'Raw LDR draft check; source model has no reviewed assembly support graph.',
      },
    })
  }

  if (placements.length > 0 || steps.length === 0) steps.push({ step: stepNumber, placements })
  return { assembly: { model: ldrFile, steps }, errors }
}

async function main() {
  const modelsDir = resolve(process.cwd(), 'scripts/ldraw-models')
  const mpdDir = resolve(process.cwd(), 'public/courses/ldraw')

  const files = await readdir(modelsDir)
  const ldrFiles = files.filter((file) => {
    if (!file.endsWith('.ldr')) return false
    const slug = basename(file, '.ldr')
    return !existsSync(join(mpdDir, `${slug}.mpd`))
  }).sort()

  const partMetadata = await loadPartMetadata()
  const failed = []
  
  for (const ldrFile of ldrFiles) {
    const ldrPath = join(modelsDir, ldrFile)
    const content = await readFile(ldrPath, 'utf8')
    const { assembly, errors: parseErrors } = ldrToAssembly(ldrFile, content)
    const validation = resolveAssembly(assembly, partMetadata)
    const errors = [...parseErrors, ...validation.errors]
    const placementCount = assembly.steps.reduce((sum, step) => sum + (step.placements?.length ?? 0), 0)

    if (errors.length > 0) {
      failed.push({ ldrFile, placementCount, errors })
      console.log(`\nFAIL [${ldrFile}] ${errors.length} error(s), ${placementCount} placement(s):`)
      for (const error of errors.slice(0, 20)) console.log(`  - ${error}`)
      if (errors.length > 20) console.log(`  ... ${errors.length - 20} more`)
    } else {
      console.log(`OK   [${ldrFile}] ${placementCount} placement(s)`)
    }
  }

  console.log(`\nChecked ${ldrFiles.length} LDR source model(s) without matching MPD.`)
  console.log(`${ldrFiles.length - failed.length} passed, ${failed.length} failed.`)

  if (failed.length > 0) process.exit(2)
}

main().catch(console.error)

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

  const allPlacements = steps.flatMap((step) => step.placements)
  for (const placement of allPlacements) {
    if (placement.partId !== '90265.dat') continue

    const paneTransform = placement.ldrawLine.split(/\s+/).slice(2, 14).map(Number)
    const matchingFrame = allPlacements.find((candidate) => {
      if (candidate.partId !== '61649.dat') return false
      const frameTransform = candidate.ldrawLine.split(/\s+/).slice(2, 14).map(Number)
      const sameOrientation = paneTransform.slice(3).every((value, index) => Math.abs(value - frameTransform[index + 3]) < 1e-6)
      const delta = paneTransform.slice(0, 3).map((value, index) => value - frameTransform[index])
      const distance = Math.hypot(...delta)
      return sameOrientation && Math.abs(delta[1] - 72) < 3 && distance < 110
    })
    if (!matchingFrame) continue

    placement.decorative = true
  }

  for (const brick of allPlacements) {
    if (brick.partId !== '3011.dat') continue
    const brickTransform = brick.ldrawLine.split(/\s+/).slice(2, 14).map(Number)
    const curvedNeighbors = allPlacements.filter((candidate) => {
      if (candidate.partId !== '2302.dat') return false
      const curvedTransform = candidate.ldrawLine.split(/\s+/).slice(2, 14).map(Number)
      const sameLayerAndRow = Math.abs(brickTransform[1] - curvedTransform[1]) < 1e-6
        && Math.abs(brickTransform[2] - curvedTransform[2]) < 1e-6
      const oneStudOriginOffset = Math.abs(Math.abs(brickTransform[0] - curvedTransform[0]) - 40) < 1e-6
      const brickFacesNorth = brickTransform.slice(3).every((value, index) => Math.abs(value - [1, 0, 0, 0, 1, 0, 0, 0, 1][index]) < 1e-6)
      const curveFacesOutward = Math.abs(curvedTransform[3]) === 1
        && curvedTransform[4] === 0
        && curvedTransform[5] === 0
        && curvedTransform[6] === 0
        && curvedTransform[7] === 1
        && curvedTransform[8] === 0
        && curvedTransform[9] === 0
        && curvedTransform[10] === 0
        && Math.abs(curvedTransform[11]) === 1
      return sameLayerAndRow && oneStudOriginOffset && brickFacesNorth && curveFacesOutward
    })
    if (curvedNeighbors.length === 0) continue
    brick.acceptedOverlaps = [
      ...(brick.acceptedOverlaps ?? []),
      ...curvedNeighbors.map((neighbor) => ({
        id: neighbor.id,
        reason: 'Official 2302.dat curved nose shares the adjacent nominal stud cell with 3011.dat; source-confirmed outward corner and rendered geometry do not intersect.',
      })),
    ]
  }

  return { assembly: { model: ldrFile, steps }, errors }
}

async function main() {
  const modelsDir = resolve(process.cwd(), 'scripts/ldraw-models')
  const mpdDir = resolve(process.cwd(), 'public/courses/ldraw')
  const requestedPaths = process.argv.slice(2)

  let ldrFiles
  if (requestedPaths.length > 0) {
    ldrFiles = requestedPaths.map((input) => {
      const path = resolve(process.cwd(), input)
      if (!path.endsWith('.ldr')) throw new Error(`expected an .ldr file: ${input}`)
      if (!existsSync(path)) throw new Error(`LDR file not found: ${input}`)
      return { name: basename(path), path }
    })
  } else {
    const files = await readdir(modelsDir)
    ldrFiles = files.filter((file) => {
      if (!file.endsWith('.ldr')) return false
      const slug = basename(file, '.ldr')
      return !existsSync(join(mpdDir, `${slug}.mpd`))
    }).sort().map((file) => ({ name: file, path: join(modelsDir, file) }))
  }

  const partMetadata = await loadPartMetadata()
  const failed = []
  
  for (const ldrFile of ldrFiles) {
    const content = await readFile(ldrFile.path, 'utf8')
    const { assembly, errors: parseErrors } = ldrToAssembly(ldrFile.name, content)
    const validation = resolveAssembly(assembly, partMetadata)
    const errors = [...parseErrors, ...validation.errors]
    const placementCount = assembly.steps.reduce((sum, step) => sum + (step.placements?.length ?? 0), 0)

    if (errors.length > 0) {
      failed.push({ ldrFile: ldrFile.name, placementCount, errors })
      console.log(`\nFAIL [${ldrFile.name}] ${errors.length} error(s), ${placementCount} placement(s):`)
      for (const error of errors.slice(0, 20)) console.log(`  - ${error}`)
      if (errors.length > 20) console.log(`  ... ${errors.length - 20} more`)
    } else {
      console.log(`OK   [${ldrFile.name}] ${placementCount} placement(s)`)
    }
  }

  const scope = requestedPaths.length > 0 ? 'requested LDR source model(s)' : 'LDR source model(s) without matching MPD'
  console.log(`\nChecked ${ldrFiles.length} ${scope}.`)
  console.log(`${ldrFiles.length - failed.length} passed, ${failed.length} failed.`)

  if (failed.length > 0) process.exit(2)
}

main().catch(console.error)

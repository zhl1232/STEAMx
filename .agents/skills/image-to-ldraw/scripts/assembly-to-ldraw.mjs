#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildReport,
  ldrawBody,
  ldrawHeader,
  loadPartMetadata,
  readJson,
  resolveAssembly,
  writeJson,
} from './ldraw-common.mjs'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') {
      args.out = argv[++i]
    } else if (arg === '--report') {
      args.report = argv[++i]
    } else if (!args.assemblyPath) {
      args.assemblyPath = arg
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  if (!args.assemblyPath) throw new Error('usage: assembly-to-ldraw.mjs <assembly.json> [--out model.ldr] [--report report.json]')
  return args
}

function modelSlug(assembly, assemblyPath) {
  if (assembly.model) return String(assembly.model).replace(/\.ldr$/i, '')
  return assemblyPath.replace(/\.json$/i, '').split(/[\\/]/).pop()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const assemblyPath = resolve(process.cwd(), args.assemblyPath)
  const assembly = await readJson(assemblyPath)
  const slug = modelSlug(assembly, args.assemblyPath)
  const outPath = resolve(process.cwd(), args.out ?? `scripts/ldraw-models/${slug}.ldr`)
  const reportPath = resolve(process.cwd(), args.report ?? outPath.replace(/\.ldr$/i, '.report.json'))
  const bomPath = outPath.replace(/\.ldr$/i, '.bom.json')

  const partMetadata = await loadPartMetadata()
  const validation = resolveAssembly(assembly, partMetadata)
  if (validation.errors.length > 0) {
    for (const error of validation.errors) process.stderr.write(`- ${error}\n`)
    throw new Error(`refusing to generate LDraw with ${validation.errors.length} validation error(s)`)
  }

  const lines = [
    ...ldrawHeader(assembly, slug),
    ...ldrawBody(assembly, validation),
  ]
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, lines.join('\n') + '\n', 'utf8')
  await writeJson(bomPath, {
    model: `${slug}.ldr`,
    totalParts: validation.resolved.length,
    items: validation.bom,
  })
  await writeJson(reportPath, {
    ...buildReport(assembly, validation),
    outputs: { ldr: outPath, bom: bomPath },
  })

  process.stderr.write(`wrote ${outPath}\n`)
  process.stderr.write(`wrote ${bomPath}\n`)
  process.stderr.write(`wrote ${reportPath}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exit(1)
})

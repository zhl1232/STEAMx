#!/usr/bin/env node
import { resolve } from 'node:path'

import {
  buildReport,
  loadPartMetadata,
  readJson,
  resolveAssembly,
  writeJson,
} from './ldraw-common.mjs'

function parseArgs(argv) {
  const args = { report: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--report') {
      args.report = argv[++i]
    } else if (!args.assemblyPath) {
      args.assemblyPath = arg
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  if (!args.assemblyPath) throw new Error('usage: validate-assembly.mjs <assembly.json> [--report report.json]')
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const assemblyPath = resolve(process.cwd(), args.assemblyPath)
  const assembly = await readJson(assemblyPath)
  const partMetadata = await loadPartMetadata()
  const validation = resolveAssembly(assembly, partMetadata)
  const report = buildReport(assembly, validation)

  if (args.report) await writeJson(resolve(process.cwd(), args.report), report)
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')

  if (validation.errors.length > 0) {
    process.stderr.write(`assembly validation failed with ${validation.errors.length} error(s)\n`)
    process.exit(2)
  }
  process.stderr.write(`assembly validation passed: ${validation.resolved.length} placement(s)\n`)
  if (validation.warnings.length > 0) process.stderr.write(`warnings: ${validation.warnings.length}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exit(1)
})

#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha = body => createHash('sha256').update(body).digest('hex')
export async function planLedAssets() {
  const entries = JSON.parse(await readFile(path.join(root, 'docs/releases/2026-10-09/assets.json'), 'utf8')).filter(x => x.kind === 'led')
  if (entries.length !== 5) throw new Error('Expected exactly five LED WebP objects')
  return Promise.all(entries.map(async item => {
    if (!/^projects\/(generated|steps)\/project-0149-[a-z-]+-20261008\.webp$/.test(item.key) || item.path !== `public/${item.key}`) throw new Error('LED object outside release whitelist')
    const body = await readFile(path.join(root, item.path))
    if (sha(body) !== item.sha256) throw new Error(`Local hash mismatch: ${item.key}`)
    return { ...item, body }
  }))
}

export async function uploadLedAssets(plan, client, onProgress = async () => {}) {
  const results = []
  for (const item of plan) {
    let exists = true
    try { await client.head(item.key) } catch (error) {
      if (['NoSuchKey', 'NotFound'].includes(error?.code) || error?.status === 404) exists = false
      else throw new Error(`HEAD failed for ${item.key}`)
    }
    if (exists) {
      const existing = await client.get(item.key)
      if (sha(existing.content) !== item.sha256) throw new Error(`Existing object differs: ${item.key}`)
    } else {
      await client.put(item.key, item.body, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } })
      const result = await client.get(item.key)
      if (sha(result.content) !== item.sha256) throw new Error(`Uploaded object readback differs: ${item.key}`)
    }
    results.push({ key: item.key, sha256: item.sha256, status: exists ? 'verified-existing' : 'uploaded-verified' })
    await onProgress(results)
  }
  return results
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(a => a !== '--upload' && !a.startsWith('--receipt='))) throw new Error('Use [--upload --receipt=<path>]')
  const plan = await planLedAssets()
  if (!args.includes('--upload')) {
    console.log(JSON.stringify({ dryRun: true, assets: plan.map(({ body, ...item }) => item) }, null, 2))
    return
  }
  const receipt = args.find(a => a.startsWith('--receipt='))?.slice(10)
  if (!receipt) throw new Error('Upload requires a receipt path')
  await writeFile(receipt, JSON.stringify({ assets: [] }))
  const { createOssClient } = await import('../lib/utils/oss-client.mjs')
  await uploadLedAssets(plan, createOssClient(), assets => writeFile(receipt, JSON.stringify({ assets }, null, 2)))
  console.log('Five LED objects uploaded or verified; receipt saved.')
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(() => {
  // SDK exceptions can contain request headers; never print them.
  console.error('LED asset operation failed; no database changes performed. Check configuration and the partial receipt.')
  process.exitCode = 1
})

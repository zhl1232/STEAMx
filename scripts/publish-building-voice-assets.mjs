#!/usr/bin/env node
// Public, pinned speech resources only. No bucket policies, CORS, ACL or credentials are changed.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { createOssClient } from '../lib/utils/oss-client.mjs'

const upload = process.argv.slice(2).includes('--upload')
if (process.argv.slice(2).some(arg => !['--upload', '--dry-run'].includes(arg))) throw new Error('Use --dry-run or --upload')
if (upload && process.argv.includes('--dry-run')) throw new Error('Choose one mode')
const root = new URL('../public/courses/vosk/', import.meta.url)
const assets = runInNewContext(`${await readFile(new URL('v2/assets.js', root), 'utf8')}; BUILDING_VOICE_ASSETS`)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const plan = []
for (const [name, asset] of Object.entries(assets)) {
  const url = new URL(asset.url)
  if (url.origin !== 'https://assets.steamx.cc' || url.pathname !== `/courses/vosk/${asset.sha256}/${name}` || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Unexpected public destination')
  const body = await readFile(new URL(`v1/${name}`, root))
  if (body.byteLength !== asset.bytes || sha(body) !== asset.sha256) throw new Error(`Local integrity: ${name}`)
  plan.push({ key: url.pathname.slice(1), body, hash: asset.sha256, type: name.endsWith('.gz') ? 'application/gzip' : 'application/javascript; charset=utf-8' })
}
for (const name of ['COPYING', 'NOTICE.md', 'UPSTREAM-NOTICE', 'UUID-LICENSE', 'model-source.json']) {
  const body = await readFile(new URL(`v1/${name}`, root))
  plan.push({ key: `courses/vosk/licenses/${sha(body)}/${name}`, body, hash: sha(body), type: 'text/plain; charset=utf-8' })
}
console.log(JSON.stringify({ mode: upload ? 'upload' : 'dry-run', objects: plan.map(({ key, body, hash }) => ({ key, bytes: body.length, sha256: hash })) }, null, 2))
if (upload) {
  const client = createOssClient()
  // Use the environment's existing HTTPS proxy when provided, with TLS validation intact.
  if (process.env.HTTPS_PROXY) {
    const { HttpsProxyAgent } = createRequire(import.meta.url)('next/dist/compiled/https-proxy-agent')
    client.httpsAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY)
  }
  for (const item of plan) {
    try {
      let exists = true
      try { await client.head(item.key) } catch (error) { if (error.code === 'NoSuchKey') exists = false; else throw error }
      if (!exists) await client.put(item.key, item.body, { timeout: 300_000, headers: {
        'Content-Type': item.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'x-oss-forbid-overwrite': 'true',
      } })
      const result = await client.get(item.key, { timeout: 300_000 })
      if (sha(result.content) !== item.hash) throw Object.assign(new Error('Readback mismatch'), { code: 'IntegrityMismatch' })
      console.log(JSON.stringify({ key: item.key, verified: true, existed: exists }))
    } catch (error) {
      // SDK errors may contain signed URLs/headers. Never print those.
      console.error(JSON.stringify({ key: item.key, code: error.code ?? 'UploadFailed', status: error.status ?? null }))
      process.exitCode = 1; break
    }
  }
}

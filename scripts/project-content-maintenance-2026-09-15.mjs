/** Scoped content withdrawal backup and resource cleanup; SQL runs through pnpm db:push. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createOssClient } from '../lib/utils/oss-client.mjs'

const withdrawn = [296, 300, 302, 321, 358, 373, 381]
const corrected = [31, 39, 51, 52, 158, 259, 263, 319, 320, 343, 359, 378]
const archive = '/home/arron/archives/steamx/explore-content-2026-09-15'
for (const line of (await fs.readFile('.env.local', 'utf8')).split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
async function query(sql) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const data = await r.json()
  if (!r.ok || !Array.isArray(data) || data.some(x => x.error)) throw new Error(JSON.stringify(data))
  return data
}
const hash = data => createHash('sha256').update(data).digest('hex')
const ids = [...withdrawn, ...corrected].join(',')
const snapshotPath = path.join(archive, 'before.json')
await fs.mkdir(archive, { recursive: true })
let snapshot
try { snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) } catch (e) {
  if (e.code !== 'ENOENT') throw e
  snapshot = { createdAt: new Date().toISOString(), host: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host }
  for (const [table, column] of [['projects', 'id'], ['project_steps', 'project_id'], ['project_materials', 'project_id']]) {
    snapshot[table] = await query(`SELECT * FROM public.${table} WHERE ${column} IN (${ids}) ORDER BY id`)
  }
  if (snapshot.projects.length !== 19) throw new Error('Expected exactly 19 projects')
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), { flag: 'wx', mode: 0o600 })
}
if (snapshot.host !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host) throw new Error('Backup environment mismatch')
const titles = new Set(snapshot.projects.filter(p => withdrawn.includes(p.id)).map(p => p.title))
const stepIds = new Set(snapshot.project_steps.filter(s => withdrawn.includes(s.project_id)).map(s => s.id))
const keys = new Set()
function keyFromURL(value) {
  if (typeof value !== 'string' || !value) return null
  const parsed = new URL(value, 'https://local.invalid')
  if (parsed.hostname !== 'local.invalid' && parsed.hostname !== new URL(process.env.NEXT_PUBLIC_ASSETS_BASE_URL).hostname) return null
  const key = parsed.pathname.replace(/^\/api\/assets\//, '').replace(/^\//, '')
  return /^projects\/(generated|steps)\/[A-Za-z0-9_.-]+$/.test(key) ? key : null
}
for (const row of [...snapshot.projects.filter(p => withdrawn.includes(p.id)), ...snapshot.project_steps.filter(s => withdrawn.includes(s.project_id))]) {
  const key = keyFromURL(row.image_url)
  if (key) keys.add(key)
}
function owned(key) {
  const p = key.match(/^projects\/generated\/project-0*(\d+)(?:[-.]|$)/)
  const s = key.match(/^projects\/steps\/step-0*(\d+)(?:[-.]|$)/)
  return (p && withdrawn.includes(Number(p[1]))) || (s && stepIds.has(Number(s[1])))
}
const manifestPaths = ['public/projects/generated/manifest.json', 'public/manifests/projects.json']
for (const file of manifestPaths) {
  try { await fs.copyFile(file, path.join(archive, path.basename(path.dirname(file)) + '-' + path.basename(file)), fs.constants.COPYFILE_EXCL) } catch(e) { if (e.code !== 'EEXIST' && e.code !== 'ENOENT') throw e }
}
const generatedManifest = JSON.parse(await fs.readFile(manifestPaths[0], 'utf8'))
for (const row of generatedManifest) {
  if (titles.has(row.title)) {
    const key = keyFromURL(row.imageUrl || `/projects/generated/${row.filename}`)
    if (key) keys.add(key)
  }
}
const client = createOssClient()
async function ossRead(method, key) {
  for (let attempt = 1; ; attempt++) {
    try { return await client[method](key, { timeout: 15000 }) }
    catch (e) {
      if (attempt >= 3 || !/Timeout|ECONNRESET|EAI_AGAIN|Socket/i.test(e.code || e.name || '')) throw e
      console.log(`Retry ${method}: ${key} (${attempt}/3)`)
    }
  }
}
for (const prefix of ['projects/generated/', 'projects/steps/']) {
  let marker
  do {
    const r = await client.list({ prefix, marker, 'max-keys': 1000 })
    for (const object of r.objects || []) if (owned(object.name)) keys.add(object.name)
    marker = r.isTruncated ? r.nextMarker : undefined
  } while (marker)
  let localNames = []
  try { localNames = await fs.readdir(path.join('public', prefix)) } catch(e) { if(e.code !== 'ENOENT') throw e }
  for (const name of localNames) if (owned(prefix + name)) keys.add(prefix + name)
}
// Protect other content including nested URLs, even if a filename looks owned.
const protectedKeysSet = new Set()
// Older manifest indexes are NOT database project IDs. Keep assets named for other lessons.
for (const row of generatedManifest) {
  if (!titles.has(row.title)) {
    const key = keyFromURL(row.imageUrl || `/projects/generated/${row.filename}`)
    if (keys.has(key)) protectedKeysSet.add(key)
  }
}
const referenceTables = ['projects', 'project_steps', 'courses', 'course_lessons', 'learning_resources', 'completed_projects', 'comments', 'challenges', 'project_journey_records', 'completion_comments', 'discussions', 'discussion_replies', 'observation_events', 'challenge_submissions', 'challenge_workspaces', 'store_products']
for (const table of referenceTables) {
  const predicate = table === 'projects' ? `WHERE id NOT IN (${withdrawn})`
    : table === 'project_steps' ? `WHERE project_id NOT IN (${withdrawn})` : ''
  const candidates = [...keys].map(key => `('${key}')`).join(',')
  if (candidates) for (const row of await query(`SELECT k.key FROM (VALUES ${candidates}) AS k(key) WHERE EXISTS (SELECT 1 FROM public.${table} t ${predicate ? predicate + ' AND' : 'WHERE'} strpos(to_jsonb(t)::text,k.key)>0)`)) protectedKeysSet.add(row.key)
}
const protectedKeys = [...protectedKeysSet]
for (const key of protectedKeys) keys.delete(key)
const plan = { withdrawn, corrected, keys: [...keys].sort(), protectedKeys, archive }
await fs.writeFile(path.join(archive, 'resource-plan.json'), JSON.stringify(plan, null, 2))
console.log(JSON.stringify({ ...plan, keys: plan.keys, backupRows: snapshot.projects.length }, null, 2))
const execute = process.argv.includes('--execute-resources')
if (!execute && !process.argv.includes('--backup-resources')) process.exit(0)
if (execute) {
  const states = await query(`SELECT id,status,image_url FROM projects WHERE id IN (${withdrawn})`)
  if (states.length !== 7 || states.some(x => x.status !== 'draft' || x.image_url)) throw new Error('Apply withdrawal migration first')
  const stepRefs = await query(`SELECT id FROM project_steps WHERE project_id IN (${withdrawn}) AND image_url IS NOT NULL`)
  if (stepRefs.length) throw new Error('Withdrawn step references remain')
}
const results = []
// Back up EVERY existing object before any deletion. A missing object is safe; other errors abort.
const queue = [...plan.keys]
const backupWorker = async () => { for (let key; (key = queue.shift());) {
  const result = { key, oss: false, local: false }
  for (const source of ['oss', 'local']) {
    let body
    try { body = source === 'oss' ? (await ossRead('get', key)).content : await fs.readFile(path.join('public', key)) }
    catch (e) { if (e.code === 'NoSuchKey' || e.code === 'ENOENT') continue; throw e }
    const dest = path.join(archive, source, key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    try { await fs.writeFile(dest, body, { flag: 'wx' }) } catch(e) { if(e.code !== 'EEXIST') throw e }
    if (hash(await fs.readFile(dest)) !== hash(body)) throw new Error(`Backup mismatch: ${key}`)
    result[source] = true
    result[source + 'Hash'] = hash(body)
  }
  results.push(result)
  if (results.length % 10 === 0) console.log(`Backed up ${results.length}/${plan.keys.length} assets`)
} }
await Promise.all(Array.from({ length: 4 }, backupWorker))
results.sort((a, b) => a.key.localeCompare(b.key))
await fs.writeFile(path.join(archive, 'resource-backups.json'), JSON.stringify(results, null, 2))
if (!execute) { console.log('Resource backup complete; no resources deleted'); process.exit(0) }
for (const row of results) {
  // Recheck current references immediately before deletion, including archived rows.
  const references = await query(referenceTables.map(table => `SELECT '${table}' AS source WHERE EXISTS (SELECT 1 FROM public.${table} t WHERE strpos(to_jsonb(t)::text,'${row.key}')>0)`).join(' UNION ALL '))
  if (references.length) throw new Error(`Asset acquired a reference; cleanup stopped: ${row.key}`)
  if (row.oss) {
    if (hash((await ossRead('get', row.key)).content) !== row.ossHash) throw new Error(`OSS asset changed after backup: ${row.key}`)
    await client.delete(row.key)
    try { await ossRead('head', row.key); throw new Error(`Object still exists: ${row.key}`) }
    catch (e) { if(e.code !== 'NoSuchKey') throw e }
  }
  if (row.local) {
    if (hash(await fs.readFile(path.join('public', row.key))) !== row.localHash) throw new Error(`Local asset changed after backup: ${row.key}`)
    await fs.unlink(path.join('public', row.key))
  }
}
const remove = value => typeof value === 'string' && keys.has(keyFromURL(value))
await fs.writeFile(manifestPaths[0], JSON.stringify(generatedManifest.filter(row => !remove(row.imageUrl || `/projects/generated/${row.filename}`)), null, 2) + '\n')
const assetsManifest = JSON.parse(await fs.readFile(manifestPaths[1], 'utf8'))
assetsManifest.files = assetsManifest.files.filter(value => !remove(value))
await fs.writeFile(manifestPaths[1], JSON.stringify(assetsManifest, null, 2) + '\n')
await fs.writeFile(path.join(archive, 'completed.json'), JSON.stringify({ completedAt: new Date().toISOString(), ...plan, results }, null, 2))
console.log(`Resource cleanup complete: ${results.filter(r => r.oss).length} OSS, ${results.filter(r => r.local).length} local; ${protectedKeys.length} shared assets preserved`)

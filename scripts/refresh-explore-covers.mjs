#!/usr/bin/env node
/** Reviewed video-cover maintenance. Preparation is local; upload and SQL generation are explicit modes. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const exec = promisify(execFile)
const args = process.argv.slice(2)
const mode = args[0] === '--help' ? 'help' : args[0] || 'help'
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const archive = path.resolve(option('archive', '/home/arron/archives/steamx/explore-covers-2026-09-22'))
const ids = option('ids', '').split(',').filter(Boolean).map(Number)
if (ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw new Error('IDs must be unique positive safe integers')
const digest = b => createHash('sha256').update(b).digest('hex')
const json = file => fs.readFile(path.join(archive, file), 'utf8').then(JSON.parse)
const save = async (file, data) => {
  const dest = path.join(archive, file)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(`${dest}.tmp`, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  await fs.rename(`${dest}.tmp`, dest)
}
const exists = file => fs.access(file).then(() => true, () => false)
const selected = rows => ids.length ? rows.filter(r => ids.includes(r.id)) : rows
async function pool(rows, work, count = 6) {
  const queue = [...rows]
  const failed = []
  await Promise.all(Array.from({ length: Math.min(count, rows.length) }, async () => {
    for (let row; (row = queue.shift());) {
      try { await work(row) } catch (error) { failed.push(row.id); console.error(`Project ${row.id}: ${error.message}`) }
    }
  }))
  if (failed.length) throw new Error(`${failed.length} items failed (${failed.join(',')}); completed files preserved for resume`)
}
async function env() {
  const data = await fs.readFile('.env.local', 'utf8')
  for (const line of data.split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
async function query(sql) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`, {
    method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(60000),
  })
  const data = await response.json()
  if (!response.ok || !Array.isArray(data) || data.some(r => r.error)) throw new Error('Database query failed')
  return data
}
async function download(url, file) {
  if (await exists(file)) return fs.readFile(file)
  const response = await fetch(url, { headers: { Referer: 'https://steam.bj.cn/' }, signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Asset HTTP ${response.status}`)
  const data = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, data, { flag: 'wx' })
  return data
}
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
async function contactSheets(rows, type) {
  const directory = option('sheet-set', `${type}-sheets`)
  if (!/^[a-z0-9-]+$/i.test(directory)) throw new Error('Invalid sheet-set name')
  const width = type === 'candidates' ? 280 : 250
  const height = type === 'candidates' ? 182 : 170
  const cols = type === 'candidates' ? 4 : 6
  const perPage = type === 'candidates' ? 24 : 48
  for (let start = 0; start < rows.length; start += perPage) {
    const group = rows.slice(start, start + perPage)
    const composites = []
    for (let j = 0; j < group.length; j++) {
      const row = group[j]
      const left = j % cols * width, top = Math.floor(j / cols) * height
      const file = path.join(archive, row.file || `covers/${row.id}.img`)
      if (await exists(file)) {
        try {
          composites.push({ input: await sharp(file).resize(width - 8, height - 30, { fit: 'contain', background: '#f1f3f5' }).png().toBuffer(), left: left + 4, top: top + 26 })
        } catch { /* Missing/invalid assets remain visibly blank in the inventory. */ }
      }
      const label = `${row.id}${row.frame !== undefined ? ` [${row.frame}] ${row.seconds.toFixed(1)}s` : ''} ${row.title || ''}`
      composites.push({ input: Buffer.from(`<svg width="${width}" height="26"><rect width="100%" height="100%" fill="white"/><text x="5" y="18" font-family="sans-serif" font-size="13" fill="#18202b">${escapeXml(label)}</text></svg>`), left, top })
    }
    const file = path.join(archive, directory, `${String(start / perPage + 1).padStart(2, '0')}.jpg`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await sharp({ create: { width: cols * width, height: Math.ceil(group.length / cols) * height, channels: 3, background: '#d9e0e5' } }).composite(composites).jpeg({ quality: 88 }).toFile(file)
    await save(`${directory}/${String(start / perPage + 1).padStart(2, '0')}.json`, group.map(({ id, title, frame, seconds, file }) => ({ id, title, frame, seconds, file })))
    console.log(file)
  }
}

if (mode === 'help') {
  console.log('Modes: snapshot | covers | sheets | extract --ids=1,2 | sample --ids=1 --seconds=10,20 | candidates | preview [--frame=3] | propose | decide --ids=1,2 --decision=keep|replace|unavailable [--frame=0] --reason=... | upload | migration | verify. Optional --archive=DIR, --ffmpeg=PATH, --sheet-set=NAME. Proposals are not decisions; decisions require visual review. No mode executes SQL mutations.')
  process.exit(0)
}
await fs.mkdir(archive, { recursive: true })
if (mode === 'snapshot') {
  await env()
  if (await exists(path.join(archive, 'snapshot.json'))) throw new Error('Snapshot exists; use a fresh archive to avoid replacing the review baseline')
  const settings = await query('SELECT enforcement_enabled FROM public.content_classification_settings WHERE id = true')
  const rows = await query(`SELECT id,title,author_id,image_url,video_url,status,moderation_state,classification_status FROM public.projects WHERE status='approved' AND moderation_state='approved' AND video_url IS NOT NULL AND video_url <> '' ${settings[0]?.enforcement_enabled ? "AND classification_status='reviewed'" : ''} ORDER BY id`)
  await save('snapshot.json', { at: new Date().toISOString(), host: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host, rows })
  console.log(`Snapshot: ${rows.length} public video projects`)
  process.exit(0)
}
const snapshot = await json('snapshot.json')
if (ids.some(id => !snapshot.rows.some(row => row.id === id))) throw new Error('Unknown project ID in selection')
const rows = selected(snapshot.rows)
if (mode === 'covers') {
  await pool(rows, async row => {
    if (!row.image_url) throw new Error('No original cover')
    const data = await download(row.image_url, path.join(archive, `covers/${row.id}.img`))
    const metadata = await sharp(data).metadata()
    await save(`covers/${row.id}.json`, { id: row.id, sha256: digest(data), width: metadata.width, height: metadata.height })
    console.log(`Cover ${row.id}`)
  })
} else if (mode === 'sheets') {
  await contactSheets(rows, 'covers')
} else if (mode === 'extract') {
  if (!ids.length) throw new Error('Explicit --ids required after inspecting original covers')
  const ffmpeg = option('ffmpeg', '/tmp/explore-video-review-venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
  await pool(rows, async row => {
    if (await exists(path.join(archive, `candidates/${row.id}.json`))) return
    const videoFile = path.join(archive, `videos/${row.id}.mp4`)
    const data = await download(row.video_url, videoFile)
    let info
    try { info = await exec(ffmpeg, ['-i', videoFile], { timeout: 20000 }) } catch (error) { info = error }
    const match = info.stderr?.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
    if (!match) throw new Error('Cannot read video duration')
    const duration = +match[1] * 3600 + +match[2] * 60 + +match[3]
    const frames = []
    for (const [frame, fraction] of [.35, .55, .75, .9].entries()) {
      const seconds = duration * fraction
      const file = `candidates/${row.id}-${frame}.webp`
      await fs.mkdir(path.join(archive, 'candidates'), { recursive: true })
      await exec(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seconds), '-i', videoFile, '-frames:v', '1', '-vf', 'scale=960:-2', '-threads', '1', '-quality', '82', path.join(archive, file)], { timeout: 45000 })
      const image = await fs.readFile(path.join(archive, file))
      frames.push({ id: row.id, title: row.title, frame, seconds, file, sha256: digest(image) })
    }
    await save(`candidates/${row.id}.json`, { id: row.id, duration, videoSha256: digest(data), frames })
    console.log(`Candidates ${row.id}`)
  }, 4)
} else if (mode === 'sample') {
  const seconds = option('seconds', '').split(',').filter(Boolean).map(Number)
  if (!ids.length || !seconds.length || seconds.some(s => !Number.isFinite(s) || s < 0)) throw new Error('Explicit IDs and finite nonnegative --seconds required')
  const ffmpeg = option('ffmpeg', '/tmp/explore-video-review-venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
  for (const row of rows) {
    const candidate = await json(`candidates/${row.id}.json`)
    for (const time of seconds) {
      if (time >= candidate.duration) throw new Error('Sample time exceeds video duration')
      if (candidate.frames.some(f => f.seconds === time)) continue
      const frame = candidate.frames.length, file = `candidates/${row.id}-${frame}.webp`
      await exec(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(time), '-i', path.join(archive, `videos/${row.id}.mp4`), '-frames:v', '1', '-vf', 'scale=960:-2', '-threads', '1', '-quality', '82', path.join(archive, file)], { timeout: 45000 })
      candidate.frames.push({ id: row.id, title: row.title, frame, seconds: time, file, sha256: digest(await fs.readFile(path.join(archive, file))) })
    }
    await save(`candidates/${row.id}.json`, candidate)
  }
} else if (mode === 'candidates' || mode === 'preview') {
  const frames = []
  for (const row of rows) {
    if (await exists(path.join(archive, `candidates/${row.id}.json`))) {
      const available = (await json(`candidates/${row.id}.json`)).frames
      frames.push(...(mode === 'preview' ? available.filter(f => f.frame === Number(option('frame', '3'))) : available))
    }
  }
  await contactSheets(frames, mode === 'preview' ? 'preview' : 'candidates')
} else if (mode === 'propose') {
  // Only a contact-sheet suggestion: human review is still required by decide.
  const frames = []
  for (const row of rows) {
    if (!await exists(path.join(archive, `candidates/${row.id}.json`))) continue
    const available = (await json(`candidates/${row.id}.json`)).frames
    const scores = []
    for (const frame of available) {
      const { data, info } = await sharp(path.join(archive, frame.file)).resize(64, 36).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      let cyan = 0
      for (let i = 0; i < data.length; i += info.channels) {
        const [r, g, b] = data.subarray(i, i + 3)
        if (g > 120 && b > 140 && g - r > 25 && b - g < 45 && b - g > -10) cyan++
      }
      scores.push({ frame: frame.frame, cyanFraction: cyan / (info.width * info.height) })
    }
    const preferred = [...available].reverse().find(f => scores.find(s => s.frame === f.frame).cyanFraction < .85) || available[0]
    await save(`proposals/${row.id}.json`, { ...preferred, scores, needsVisualReview: true })
    frames.push(preferred)
  }
  await contactSheets(frames, 'proposal')
} else if (mode === 'decide') {
  const decision = option('decision'), reason = option('reason')
  if (!ids.length || !['keep', 'replace', 'unavailable'].includes(decision) || !reason) throw new Error('Explicit IDs, valid decision and review reason required')
  for (const row of rows) {
    const record = { id: row.id, title: row.title, decision, reason, reviewedAt: new Date().toISOString(), oldUrl: row.image_url, videoUrl: row.video_url }
    if (decision === 'replace') {
      const candidate = await json(`candidates/${row.id}.json`)
      const frame = candidate.frames.find(f => f.frame === Number(option('frame')))
      if (!frame) throw new Error(`Project ${row.id}: choose --frame from its reviewed contact sheet`)
      Object.assign(record, { ...frame, oldSha256: (await json(`covers/${row.id}.json`)).sha256, videoSha256: candidate.videoSha256 })
    }
    await save(`decisions/${row.id}.json`, record)
  }
  console.log(`Recorded ${rows.length} reviewed decisions`)
} else if (['upload', 'migration', 'verify'].includes(mode)) {
  if (ids.length) throw new Error('Upload/migration/verify operate on the complete reviewed inventory; --ids is not accepted')
  await env()
  if (snapshot.host !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host) throw new Error('Snapshot environment mismatch')
  const decisions = []
  for (const row of snapshot.rows) {
    if (!await exists(path.join(archive, `decisions/${row.id}.json`))) throw new Error(`Project ${row.id}: review incomplete`)
    const decision = await json(`decisions/${row.id}.json`)
    if (decision.id !== row.id || decision.title !== row.title || decision.oldUrl !== row.image_url || decision.videoUrl !== row.video_url || !['keep', 'replace', 'unavailable'].includes(decision.decision)) throw new Error(`Project ${row.id}: decision does not match snapshot`)
    if (decision.decision === 'replace') decisions.push(decision)
  }
  if (mode === 'upload') {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    await pool(decisions, async row => {
      const file = await fs.readFile(path.join(archive, row.file))
      if (digest(file) !== row.sha256) throw new Error('Reviewed image changed')
      const key = `covers/explore-reviewed-20260922/${row.id}-${row.sha256.slice(0, 16)}.webp`
      const current = await query(`SELECT image_url,video_url FROM public.projects WHERE id=${Number(row.id)} AND status='approved' AND moderation_state='approved'`)
      if (current.length !== 1 || current[0].image_url !== row.oldUrl || current[0].video_url !== row.videoUrl) throw new Error('Project changed since snapshot')
      const { error } = await supabase.storage.from('project-images').upload(key, file, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
      const { data } = supabase.storage.from('project-images').getPublicUrl(key)
      const response = await fetch(data.publicUrl, { signal: AbortSignal.timeout(30000) })
      if (!response.ok || digest(Buffer.from(await response.arrayBuffer())) !== row.sha256) throw new Error(error ? `Upload failed: ${error.message}; immutable object could not be verified` : 'Uploaded image hash mismatch')
      await save(`uploaded/${row.id}.json`, { ...row, newUrl: data.publicUrl })
      console.log(`Verified upload ${row.id}`)
    }, 4)
  } else if (mode === 'migration') {
    const updates = []
    for (const row of decisions) {
      const upload = await json(`uploaded/${row.id}.json`)
      if (upload.sha256 !== row.sha256 || upload.oldUrl !== row.oldUrl) throw new Error('Upload does not match review')
      updates.push(upload)
    }
    const quote = s => `'${String(s).replaceAll("'", "''")}'`
    const sql = (reverse = false) => {
      const body = `BEGIN\n${updates.map(row => {
      const before = reverse ? row.newUrl : row.oldUrl, after = reverse ? row.oldUrl : row.newUrl
      return `  UPDATE public.projects SET image_url=${quote(after)} WHERE id=${row.id} AND image_url=${quote(before)} AND video_url=${quote(row.videoUrl)} AND title=${quote(row.title)} AND status='approved' AND moderation_state='approved';\n  IF NOT FOUND THEN RAISE EXCEPTION 'Cover baseline changed for project ${row.id}'; END IF;`
      }).join('\n')}\nEND`
      let delimiter = '$covers$'
      while (body.includes(delimiter)) delimiter = delimiter.slice(0, -1) + '_$'
      return `BEGIN;\nSET LOCAL ROLE service_role;\nSET LOCAL request.jwt.claim.role = 'service_role';\nDO ${delimiter}\n${body}\n${delimiter};\nCOMMIT;\n`
    }
    await fs.writeFile(path.join(archive, 'apply.sql'), sql())
    await fs.writeFile(path.join(archive, 'rollback.sql'), sql(true))
    await save('updates.json', updates)
    console.log(`Generated atomic migration + rollback for ${updates.length} covers; not executed`)
  } else {
    const updates = await json('updates.json')
    const current = await query(`SELECT id,title,image_url,video_url,status,moderation_state,classification_status FROM public.projects WHERE id IN (${snapshot.rows.map(r => Number(r.id)).join(',') || 'NULL'})`)
    const mismatch = snapshot.rows.filter(row => {
      const actual = current.find(c => c.id === row.id)
      const expectedUrl = updates.find(u => u.id === row.id)?.newUrl || row.image_url
      return !actual || actual.image_url !== expectedUrl || ['title', 'video_url', 'status', 'moderation_state', 'classification_status'].some(key => actual[key] !== row[key])
    })
    await save('verification.json', { at: new Date().toISOString(), checked: snapshot.rows.length, updated: updates.length, unchanged: snapshot.rows.length - updates.length, mismatches: mismatch.map(r => r.id) })
    if (mismatch.length) throw new Error(`Verification mismatch: ${mismatch.map(r => r.id).join(',')}`)
    console.log(`Verified all ${snapshot.rows.length} projects: ${updates.length} updated covers; other cover URLs and public metadata unchanged`)
  }
} else {
  throw new Error(`Unknown mode: ${mode}`)
}

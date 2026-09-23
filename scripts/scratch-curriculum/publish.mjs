#!/usr/bin/env node
/** Publish the reviewed curriculum, then remove the legacy course from discovery. */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const host = args.find((arg) => arg.startsWith('--expect-host='))?.slice(14)
const legacyId = Number(args.find((arg) => arg.startsWith('--legacy-id='))?.slice(12))
const title = 'Scratch 少儿编程入门'
const key = 'scratch-original-v1'

if (!host || !Number.isSafeInteger(legacyId) || legacyId < 1) {
  throw new Error('Use --expect-host=<Supabase host> --legacy-id=<old course id>; add --apply only after review')
}

const env = { ...process.env }
for (const line of (await readFile(path.join(process.cwd(), '.env.local'), 'utf8')).split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const divider = trimmed.indexOf('=')
  if (divider < 1) continue
  const name = trimmed.slice(0, divider).trim()
  if (!env[name]) env[name] = trimmed.slice(divider + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
}
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).host !== host) throw new Error('Target Supabase host differs from --expect-host')
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Service role key unavailable')
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const [newResult, oldResult] = await Promise.all([
  client.from('courses').select('id,title,status,is_listed,classification_status,recommended_min_age,recommended_max_age,support_level,tags').contains('tags', [key]),
  client.from('courses').select('id,title,status,is_listed').eq('id', legacyId).maybeSingle(),
])
if (newResult.error) throw newResult.error
if (oldResult.error) throw oldResult.error
if (newResult.data?.length !== 1) throw new Error('Expected exactly one original curriculum course')
const course = newResult.data[0]
const legacy = oldResult.data
if (!legacy || legacy.title !== title || legacy.status !== 'approved') throw new Error('Legacy course identity/status mismatch')
if (course.id === legacy.id) throw new Error('New and legacy course IDs must differ')
const { count, error: countError } = await client.from('course_lessons').select('id', { head: true, count: 'exact' }).eq('course_id', course.id)
if (countError) throw countError
if (count !== 48) throw new Error(`Expected 48 imported lessons, found ${count}`)
if (course.classification_status !== 'reviewed' || course.recommended_min_age !== 7 || course.recommended_max_age !== 10 || course.support_level !== 'guided') {
  throw new Error('Original curriculum classification has not been reviewed as ages 7–10 with guided support')
}
console.log(JSON.stringify({ host, newCourseId: course.id, legacyCourseId: legacy.id, lessonCount: count, apply }, null, 2))
if (!apply) {
  console.log('Read-only publication preview. Add --apply after local, asset, and classification review.')
  process.exit(0)
}
if (course.status !== 'draft' && course.status !== 'approved') throw new Error('New course must be draft or already approved')
const { data: result, error: publicationError } = await client.rpc('publish_original_scratch_course', {
  p_new_course_id: course.id,
  p_legacy_course_id: legacy.id,
})
if (publicationError) throw publicationError
if (result?.newCourseId !== course.id || result?.legacyCourseId !== legacy.id || result?.lessonCount !== 48) {
  throw new Error('Atomic publication returned unexpected course IDs or lesson count; verify database state')
}
console.log(`Course ${course.id} published; historical course ${legacy.id} remains directly accessible.`)

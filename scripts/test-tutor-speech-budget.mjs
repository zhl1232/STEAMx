// Offline migration test; never loads application env or connects to a remote DB.
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite()
try {
  await db.exec('create role anon; create role authenticated; create role service_role;')
  const migration = await readFile(new URL('../supabase/migrations/20261013090000_tutor_speech_budget.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  const call = async (kind) => (await db.query('select public.reserve_tutor_speech_request($1) as ok', [kind])).rows[0].ok
  await db.exec('set role authenticated')
  await assert.rejects(() => call('tts'), /permission denied/)
  await db.exec('reset role; set role anon')
  await assert.rejects(() => call('tts'), /permission denied/)
  await db.exec('reset role; set role service_role')
  for (let i = 0; i < 180; i++) assert.equal(await call('tts'), true)
  assert.equal(await call('tts'), false)
  for (let i = 0; i < 600; i++) assert.equal(await call('asr'), true)
  assert.equal(await call('asr'), false)
  await assert.rejects(() => call('other'), /Invalid speech kind/)
  await db.exec("reset role; update public.tutor_speech_budget set requests = array[clock_timestamp() - interval '61 seconds'] where kind='tts'; set role service_role")
  assert.equal(await call('tts'), true)
  assert.equal(await call('asr'), false)
  console.log('PASS: real SQL migration; anon/auth denied, service allowed, TTS 180/ASR 600 rolling budgets, expiry and invalid-kind guards. Single PGlite instance; not a production multi-connection concurrency test.')
} finally { await db.close() }

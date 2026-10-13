/** Offline unit tests of actual TS helpers/route; supplier, Supabase and Next adapters are mocked.
 * Run: node scripts/test-speech-security-fixes.mjs
 * This is NOT a live-model, full-app, multi-connection or production-database test.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const ts = process.env.TYPESCRIPT_MODULE_PATH ? require(process.env.TYPESCRIPT_MODULE_PATH) : require('typescript')
const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = process.env.SPEECH_FIX_BASELINE_ROOT
const abs = name => path.resolve(root, name)

function loader(mocks = {}) {
  const cache = new Map()
  return function load(name, parent = root) {
    let target = name.startsWith('@/') ? abs(name.slice(2)) : name.startsWith('.') ? path.resolve(parent, name) : name
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (Object.hasOwn(mocks, target)) return mocks[target]
    if (!path.isAbsolute(target)) return require(target)
    if (!path.extname(target)) target += '.ts'
    if (cache.has(target)) return cache.get(target).exports
    let sourceFile = target
    if (!fs.existsSync(sourceFile) && baseline) sourceFile = path.join(baseline, path.relative(root, target))
    const source = fs.readFileSync(sourceFile, 'utf8')
    const result = ts.transpileModule(source, { fileName: target, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, target)
    const module = { exports: {} }; cache.set(target, module)
    const fn = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${result.outputText}\n})`, { filename: target })
    fn(child => load(child, path.dirname(target)), module, module.exports, target, path.dirname(target))
    return module.exports
  }
}
const makeRequest = (body, options = {}) => new Request('http://localhost/test', { method: 'POST', body, ...options })
const failStatus = status => error => error.status === status
const body = loader()('./lib/api/bounded-body')

test('rejects advertised oversized bodies before parsing', async () => {
  await assert.rejects(body.readBoundedBody(makeRequest('x', { headers: { 'content-length': '999' } }), 5), failStatus(413))
})
test('rejects a dishonest Content-Length using actual streamed bytes', async () => {
  await assert.rejects(body.readBoundedBody(makeRequest('123456', { headers: { 'content-length': '1' } }), 5), failStatus(413))
})
test('counts UTF-8 bytes rather than JavaScript character length', async () => {
  await assert.rejects(body.readBoundedBody(makeRequest('中文'), 5), failStatus(413))
})
test('supports bounded chunked requests and cancels oversized streams', async () => {
  let cancelled = false
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(3)); c.enqueue(new Uint8Array(4)) }, cancel() { cancelled = true } })
  await assert.rejects(body.readBoundedBody(makeRequest(stream, { duplex: 'half' }), 5), failStatus(413))
  assert.equal(cancelled, true)
})
test('rejects slow upload without waiting on untrusted cancellation', async () => {
  const stream = new ReadableStream({ cancel() { return new Promise(() => {}) } })
  await assert.rejects(body.readBoundedBody(makeRequest(stream, { duplex: 'half' }), 5, 10), failStatus(408))
})
test('rejects already aborted uploads, including queued bytes', async () => {
  const c = new AbortController(); c.abort()
  await assert.rejects(body.readBoundedBody(makeRequest('ok', { signal: c.signal }), 5), failStatus(499))
})
test('JSON parser enforces content type and handles valid Unicode', async () => {
  await assert.rejects(body.readBoundedJson(makeRequest('{}'), 100), failStatus(415))
  assert.deepEqual(await body.readBoundedJson(makeRequest('{"x":"中文"}', { headers: { 'content-type': 'application/json; charset=utf-8' } }), 100), { x: '中文' })
})
test('rejects malformed JSON and invalid UTF-8', async () => {
  for (const payload of ['{', new Uint8Array([0xff])]) {
    await assert.rejects(body.readBoundedJson(makeRequest(payload, { headers: { 'content-type': 'application/json' } }), 100), failStatus(400))
  }
})
test('multipart parses only after the whole bounded body is accepted', async () => {
  const form = new FormData(); form.set('audio', new Blob([new Uint8Array(4)]), 'voice.pcm')
  const parsed = await body.readBoundedForm(makeRequest(form), 4096)
  assert.equal(parsed.get('audio').size, 4)
  await assert.rejects(body.readBoundedForm(makeRequest(form), 3), failStatus(413))
})

const source = loader()('./lib/ai/tutor/speech-source')
test('source parsing rejects ambiguous selectors, foreign user fields and preview text', () => {
  for (const input of [{}, { messageId: 1, text: 'x' }, { messageId: -1 }, { text: ' ' },
    { text: 'x', userId: 'victim' }, { preview: true, voice: 'x', text: 'arbitrary' }, { preview: true }, { preview: 'true' }, { fallback: 'yes', text: 'x' }]) {
    assert.throws(() => source.parseSpeechSource(input), failStatus(400))
  }
})
test('supports an opaque message id and exact-text legacy references', () => {
  assert.equal(source.parseSpeechSource({ messageId: 4 }).messageId, 4)
  assert.equal(source.parseSpeechSource({ text: 'saved' }).text, 'saved')
})
test('preview always uses fixed server text and requires membership', async () => {
  const db = { rpc() { throw new Error('Preview must not query a reply') } }
  assert.equal(await source.resolveSpeechSource(db, { preview: true, voice: 'x' }, true), source.TUTOR_VOICE_PREVIEW_TEXT)
  await assert.rejects(source.resolveSpeechSource(db, { preview: true, voice: 'x' }, false), failStatus(403))
})
test('reply resolution sends no caller owner id and no unrestricted fallback', async () => {
  let call
  const db = { rpc: async (...args) => { call = args; return { data: 'stored reply', error: null } } }
  assert.equal(await source.resolveSpeechSource(db, { messageId: 7 }, false), 'stored reply')
  assert.deepEqual(call, ['resolve_tutor_speech_reply', { p_message_id: 7, p_text: null }])
  await assert.rejects(source.resolveSpeechSource({ rpc: async () => ({ data: null, error: null }) }, { text: 'arbitrary' }, false), failStatus(404))
})
test('reply database failure fails closed, even with submitted text', async () => {
  await assert.rejects(source.resolveSpeechSource({ rpc: async () => ({ data: null, error: {} }) }, { text: 'arbitrary' }, false), failStatus(503))
})

function usageFixture(response = { ok: true, leaseId: '11111111-1111-4111-8111-111111111111' }, error = null) {
  const calls = []
  const admin = { rpc: async (name, args) => { calls.push([name, args]); return { data: name.startsWith('reserve') ? response : null, error } } }
  const use = loader({ '@/lib/supabase/admin': { supabaseAdmin: admin } })('./lib/ai/tutor/speech-usage')
  return { ...use, calls, admin }
}
test('daily and concurrency denial never invokes the supplier', async () => {
  for (const reason of ['user_daily_limit', 'global_daily_limit', 'concurrency_limit']) {
    const f = usageFixture({ ok: false, error: reason }); let called = false
    await assert.rejects(f.withSpeechUsage('u', 'tts', 20, async () => { called = true }), failStatus(429))
    assert.equal(called, false); assert.equal(f.calls.length, 1)
  }
})
test('missing RPC or malformed admission never invokes the supplier', async () => {
  for (const f of [usageFixture(null, {}), usageFixture({ ok: true, leaseId: 'bad' }), usageFixture({ ok: false, error: 'invalid_user' })]) {
    await assert.rejects(f.withSpeechUsage('u', 'tts', 20, async () => assert.fail('supplier reached')), failStatus(503))
  }
})
test('supplier success releases concurrency but never refunds daily usage', async () => {
  const f = usageFixture(); assert.equal(await f.withSpeechUsage('u', 'asr', 2, async () => 'ok'), 'ok')
  assert.deepEqual(f.calls.map(x => x[0]), ['reserve_tutor_speech_usage', 'release_tutor_speech_usage'])
  assert.equal(f.calls[0][1].p_units, 2)
})
test('supplier error releases the lease and preserves the original failure', async () => {
  const f = usageFixture(); const original = new Error('upstream failed')
  await assert.rejects(f.withSpeechUsage('u', 'asr', 1, async () => { throw original }), e => e === original)
  assert.equal(f.calls.at(-1)[0], 'release_tutor_speech_usage')
})
test('pre-abort does not acquire quota; abort during admission still releases lease', async () => {
  const c = new AbortController(); c.abort(); const f = usageFixture()
  await assert.rejects(f.withSpeechUsage('u', 'asr', 1, async () => assert.fail(), c.signal), failStatus(499))
  assert.equal(f.calls.length, 0)
  const d = new AbortController()
  const original = f.admin.rpc
  f.admin.rpc = async (...args) => { const r = await original(...args); if (args[0].startsWith('reserve')) d.abort(); return r }
  await assert.rejects(f.withSpeechUsage('u', 'asr', 1, async () => assert.fail(), d.signal), failStatus(499))
  assert.equal(f.calls.at(-1)[0], 'release_tutor_speech_usage')
})

function guardFixture() {
  const admissions = []; const transport = []; const finishCalls = []
  let deny = false
  const fakeSpeech = {
    MAX_TUTOR_SPEECH_PCM_BYTES: 1024000,
    sanitizeTutorSpeechText: text => text.trim().slice(0, 800),
    createTutorSpeechStreamer(options) {
      transport.push(['stream', options])
      return { push(text) { transport.push(['push', text]) }, finish: async () => { finishCalls.push(true); return true }, abort() {} }
    },
    synthesizeTutorSpeech: async (...args) => { transport.push(['synthesize', ...args]); return { audio: new ArrayBuffer(2) } },
    transcribeTutorSpeechPcm16: async (...args) => { transport.push(['transcribe', ...args]); return '下一步' },
  }
  const mockUsage = { withSpeechUsage: async (user, kind, units, run, signal) => {
    admissions.push({ user, kind, units }); if (deny) throw new Error('denied'); if (signal?.aborted) throw new Error('aborted'); return run()
  } }
  const guard = loader({ [abs('lib/ai/tutor/speech')]: fakeSpeech, [abs('lib/ai/tutor/speech-usage')]: mockUsage })('./lib/ai/tutor/guarded-speech')
  return { ...guard, admissions, transport, finishCalls, deny() { deny = true } }
}
test('speech input closes exactly once as soon as finish starts, before unrelated maintenance', async () => {
  const f = guardFixture(); const s = f.createGuardedTutorSpeechStreamer('u', {})
  s.push(' hello '); assert.equal(f.transport.length, 0)
  const completion = s.finish(); assert.equal(completion, s.finish())
  await completion
  assert.equal(f.finishCalls.length, 1); assert.equal(f.admissions[0].units, 5)
  s.push('late'); assert.equal(f.transport.filter(x => x[0] === 'push').length, 1)
})
test('speech admission failure is observed and produces no provider task', async () => {
  const f = guardFixture(); f.deny(); let notified = 0
  const s = f.createGuardedTutorSpeechStreamer('u', { onError() { notified++ } })
  s.push('hello'); assert.equal(await s.finish(), false); assert.equal(notified, 1); assert.equal(f.transport.length, 0)
})
test('empty and cancelled speech never acquire a daily lease', async () => {
  const f = guardFixture(); const empty = f.createGuardedTutorSpeechStreamer('u', {})
  assert.equal(await empty.finish(), false)
  const aborted = f.createGuardedTutorSpeechStreamer('u', {}); aborted.push('hello'); aborted.abort()
  assert.equal(await aborted.finish(), false); assert.equal(f.admissions.length, 0)
})
test('ASR units come from PCM bytes with upward rounding', async () => {
  const f = guardFixture(); await f.guardedTranscribeTutorSpeechPcm16('u', new ArrayBuffer(32002), { courseControl: true })
  assert.equal(f.admissions[0].units, 2); assert.equal(f.transport[0][2].courseControl, true)
})
test('malformed PCM is rejected before admission', async () => {
  const f = guardFixture()
  for (const size of [0, 1, 32001, 1024002]) await assert.rejects(f.guardedTranscribeTutorSpeechPcm16('u', new ArrayBuffer(size)), failStatus(400))
  assert.equal(f.admissions.length, 0)
})
test('legacy HTTP fallback reserves both potential physical synthesis attempts', async () => {
  const old = process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL
  try {
    const f = guardFixture(); process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL = 'legacy'
    await f.guardedSynthesizeTutorSpeech('u', 'hello', {})
    assert.equal(f.admissions[0].units, 10)
  } finally { if (old === undefined) delete process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL; else process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL = old }
})

const retry = loader()('./lib/ai/provider-retry')
test('auth, account and billing errors stop instead of walking the model list', () => {
  for (const [status, details] of [[401, null], [403, { error: { message: 'denied' } }], [400, { code: 'Arrearage' }], [429, { code: 'InsufficientBalance' }], [404, { message: 'wrong endpoint' }]]) {
    assert.equal(retry.classifyProviderFailure(status, details), 'stop')
  }
})
test('model absence switches; per-model rate limits and transient outages back off', () => {
  assert.equal(retry.classifyProviderFailure(404, { code: 'ModelNotFound' }), 'switch')
  assert.equal(retry.classifyProviderFailure(400, { error: { message: 'model does not exist' } }), 'switch')
  assert.equal(retry.classifyProviderFailure(429, { message: 'Allocated quota exceeded' }), 'backoff')
  assert.equal(retry.classifyProviderFailure(503, {}), 'backoff')
  assert.equal(retry.classifyProviderFailure(429, {}), 'stop')
  assert.equal(retry.MAX_PROVIDER_ATTEMPTS, 3)
})
test('Retry-After seconds and dates are honored, not shortened', () => {
  assert.equal(retry.providerRetryDelayMs(0, '60', 0), 60000)
  assert.equal(retry.providerRetryDelayMs(0, new Date(60000).toUTCString(), 0), 60000)
  assert.equal(retry.providerRetryDelayMs(0, null, 0, () => 0), 250)
  assert.equal(retry.providerRetryDelayMs(2, null, 0, () => 0), 1000)
})
test('backoff never starts when Retry-After exceeds the remaining chain deadline', async () => {
  assert.equal(await retry.waitForProviderRetry(60000, Date.now() + 20), false)
  assert.equal(await retry.waitForProviderRetry(1, Date.now() + 1000), true)
})

function routeFixture({ member = false, saved = 'saved reply', failure = false, slow = false } = {}) {
  const calls = []; let aborted = false; let release
  const SpeechError = loader()('./lib/ai/tutor/speech-error').TutorSpeechError
  const mockedGuard = {
    createGuardedTutorSpeechStreamer(user, options) {
      calls.push(['stream', user, options])
      return { push(text) { calls.push(['text', text]) },
        async finish() {
          if (slow) await new Promise(resolve => { release = resolve })
          if (failure) { options.onError(new SpeechError('denied', '日额度已用完', 429)); return false }
          options.onAudio('AAA=', 24000); return true
        }, abort() { aborted = true } }
    },
    guardedSynthesizeTutorSpeech: async (...args) => { calls.push(['fallback', ...args]); return { audio: new ArrayBuffer(2), contentType: 'audio/wav' } },
  }
  const db = { rpc: async (...args) => { calls.push(['source', ...args]); return { data: saved, error: null } } }
  const route = loader({
    'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/api/auth': { requireAuth: async () => ({ id: 'user-one' }), handleApiError: error => Response.json({ error: 'internal' }, { status: error.status ?? 500 }) },
    '@/lib/api/rate-limit': { requireRateLimit: async () => {} },
    '@/lib/ai/tutor/voice-access': { getTutorVoiceAccess: async () => ({ canChoose: member, voice: 'yezhiqing_v3.1' }) },
    '@/lib/ai/tutor/voice-catalog': { isTutorVoice: v => ['yezhiqing_v3.1', 'longsanshu_v3.1'].includes(v) },
    '@/lib/ai/tutor/guarded-speech': mockedGuard,
    '@/lib/ai/tutor/speech': { sanitizeTutorSpeechText: value => value.trim().slice(0, 800), TutorSpeechError: SpeechError },
  })('./app/api/tutor/speech/synthesize/route')
  return { calls, aborted: () => aborted, release: () => release?.(), post: value => route.POST(makeRequest(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })) }
}
test('route denies forged premium voice before resolving any source or opening a task', async () => {
  const f = routeFixture(); assert.equal((await f.post({ preview: true, voice: 'longsanshu_v3.1' })).status, 403)
  assert.equal(f.calls.length, 0)
})
test('route accepts member previews only from voice whitelist and server fixed text', async () => {
  const f = routeFixture({ member: true })
  assert.equal((await f.post({ preview: true, voice: 'unknown' })).status, 400)
  await (await f.post({ preview: true, voice: 'longsanshu_v3.1' })).text()
  assert.equal(f.calls.find(x => x[0] === 'text')[1], source.TUTOR_VOICE_PREVIEW_TEXT)
  assert.equal(f.calls.some(x => x[0] === 'source'), false)
})
test('route rejects arbitrary text or another user reply absent from scoped lookup', async () => {
  const f = routeFixture({ saved: null }); assert.equal((await f.post({ text: 'arbitrary' })).status, 404)
  assert.equal(f.calls.some(x => x[0] === 'stream'), false)
})
test('route sends authoritative stored text and validated voice to exactly one stream', async () => {
  const f = routeFixture({ saved: 'server reply' }); const r = await f.post({ messageId: 4 }); const text = await r.text()
  assert.equal(f.calls.filter(x => x[0] === 'stream').length, 1)
  assert.equal(f.calls.find(x => x[0] === 'text')[1], 'server reply')
  assert.match(text, /audio_done/); assert.equal(r.headers.get('cache-control'), 'no-store, no-transform')
})
test('route rejects oversized JSON before source lookup or supplier invocation', async () => {
  const f = routeFixture(); assert.equal((await f.post({ text: 'a'.repeat(270000) })).status, 413)
  assert.equal(f.calls.length, 0)
})
test('fallback has the same owned-source gate and guarded dispatch', async () => {
  const f = routeFixture(); const r = await f.post({ messageId: 4, fallback: true }); await r.arrayBuffer()
  assert.equal(f.calls.filter(x => x[0] === 'fallback').length, 1)
  assert.equal(f.calls.filter(x => x[0] === 'stream').length, 0)
  assert.equal(r.headers.get('content-type'), 'audio/wav')
})
test('failed speech stream never emits completion eligible for caching', async () => {
  const f = routeFixture({ failure: true }); const text = await (await f.post({ messageId: 4 })).text()
  assert.match(text, /"type":"error"/); assert.doesNotMatch(text, /audio_done/)
})
test('stream cancellation aborts the guarded task', async () => {
  const f = routeFixture({ slow: true }); const r = await f.post({ messageId: 4 })
  await r.body.cancel(); assert.equal(f.aborted(), true); f.release()
})

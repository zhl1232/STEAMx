/* Public static bytes only; bounded buffering, hashing and cache IO stay in this worker. */
const BUILDING_VOICE_CACHE = 'steamx-building-vosk-v1'
const VOICE_STREAM_STALL_MS = 45_000
async function readBuildingVoiceAsset(name, allowNetwork) {
  const expected = BUILDING_VOICE_ASSETS[name]
  if (!expected) throw new Error('Unknown voice asset')
  const url = expected.url
  // Reuse v1's verified payloads. Cache identity is independent of the hosting domain.
  const key = new URL(`/courses/vosk/cache/${expected.sha256}/${name}`, self.location.href).href
  const legacy = new URL(`/courses/vosk/v1/${name}`, self.location.href).href
  let lastProgress = -Infinity
  const progress = (force = false) => {
    if (!force && Date.now() - lastProgress < 250) return
    lastProgress = Date.now(); self.postMessage({ type: 'progress' })
  }
  let cache
  try { cache = await caches.open(BUILDING_VOICE_CACHE) } catch { /* Memory-only remains available. */ }
  async function verify(response) {
    if (!response.ok || !response.body) throw new Error('download')
    const reader = response.body.getReader()
    const bytes = new Uint8Array(expected.bytes)
    let offset = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (offset + value.byteLength > bytes.byteLength) throw new Error('integrity')
        bytes.set(value, offset); offset += value.byteLength
        progress()
      }
    } catch (error) { void reader.cancel().catch(() => {}); throw error }
    finally { reader.releaseLock() }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    if (offset !== expected.bytes || digest !== expected.sha256) throw new Error('integrity')
    progress()
    return bytes.buffer
  }
  async function save(bytes) {
    try { if (cache) { await cache.put(key, new Response(bytes)); return true } } catch { /* Quota/privacy mode. */ }
    return false
  }
  async function read() {
    progress()
    for (const cachedKey of [key, legacy]) {
      const response = await cache?.match(cachedKey).catch(() => undefined)
      if (!response) continue
      try {
        const bytes = await verify(response)
        // Migration is optional: don't delete a valid legacy entry unless replacement persisted.
        if (cachedKey === legacy && await save(bytes)) await cache.delete(legacy).catch(() => {})
        return { bytes, persisted: true, cached: true, source: 'cache' }
      } catch { await cache?.delete(cachedKey).catch(() => {}) }
    }
    if (!allowNetwork) return null
    let bytes, source = 'cdn'
    try { bytes = await download(url) }
    catch (error) {
      if (error.message === 'integrity' || !expected.fallbackUrl) throw error
      // These are the same public files already shipped by this site, not a proxy.
      const fallback = new URL(expected.fallbackUrl, self.location.href)
      if (fallback.origin !== new URL(self.location.href).origin || fallback.pathname !== `/courses/vosk/v1/${name}` || fallback.search || fallback.hash) throw error
      bytes = await download(fallback.href); source = 'same-origin'
    }
    return { bytes, persisted: await save(bytes), cached: false, source }
  }
  async function download(sourceUrl) {
    // A real candidate transition resets the owner's inactivity watchdog, not its total deadline.
    progress(true)
    const controller = new AbortController()
    let timer
    const heartbeat = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), VOICE_STREAM_STALL_MS) }
    heartbeat()
    try {
      // Revalidate HTTP cache on explicit retry; a corrupt response must not be reused forever.
      const response = await fetch(sourceUrl, { cache: 'no-cache', credentials: 'omit', mode: 'cors', priority: 'low', signal: controller.signal })
      if (!response.ok || !response.body) throw new Error('download')
      const reader = response.body.getReader()
      const body = new ReadableStream({
        async pull(target) {
          try {
            const { value, done } = await reader.read()
            if (done) { target.close(); reader.releaseLock() }
            else { heartbeat(); target.enqueue(value) }
          } catch (error) { target.error(error) }
        },
        cancel() { controller.abort(); return reader.cancel() },
      })
      const bytes = await verify(new Response(body))
      clearTimeout(timer)
      return bytes
    } finally { clearTimeout(timer); controller.abort() }
  }
  // The owner also enforces a total deadline and kills this worker on navigation.
  if (self.navigator.locks) {
    self.postMessage({ type: 'waiting' })
    return self.navigator.locks.request(`${BUILDING_VOICE_CACHE}:${name}`, read)
  }
  return read()
}

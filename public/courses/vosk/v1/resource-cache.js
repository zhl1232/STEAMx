/* Static assets only. Hashing and buffering stay off the course main thread. */
const BUILDING_VOICE_CACHE = 'steamx-building-vosk-v1'
async function readBuildingVoiceAsset(name, allowNetwork) {
  const expected = BUILDING_VOICE_ASSETS[name]
  if (!expected) throw new Error('Unknown voice asset')
  const url = new URL(name, self.location.href).href
  let cache
  try { cache = await caches.open(BUILDING_VOICE_CACHE) } catch { /* Memory-only preparation remains available. */ }
  async function read() {
    let response = await cache?.match(url).catch(() => undefined)
    const cached = !!response
    if (!response && !allowNetwork) return null
    if (!response) response = await fetch(url, { cache: 'force-cache', credentials: 'omit', priority: 'low' })
    if (!response.ok) throw new Error('Voice asset unavailable')
    const bytes = await response.arrayBuffer()
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    if (bytes.byteLength !== expected.bytes || digest !== expected.sha256) {
      try { await cache?.delete(url) } catch { /* Best effort eviction. */ }
      throw new Error('Voice asset integrity')
    }
    let persisted = cached
    if (!cached && cache) { try { await cache.put(url, new Response(bytes)); persisted = true } catch { /* No repeated fetch within this session. */ } }
    return { bytes, persisted, cached }
  }
  // A second tab rechecks cache after the first completes. Within a page the owner is shared.
  return self.navigator.locks ? self.navigator.locks.request(`${BUILDING_VOICE_CACHE}:${name}`, read) : read()
}

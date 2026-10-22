importScripts('./assets.js', './resource-cache.js')
self.onmessage = async ({ data }) => {
  if (data.type !== 'prepare') return
  try {
    const model = await readBuildingVoiceAsset('model.tar.gz', data.allowNetwork === true)
    if (!model) { self.postMessage({ type: 'deferred' }); return }
    const runtime = await readBuildingVoiceAsset('vosk.js', data.allowNetwork === true)
    if (!runtime) { self.postMessage({ type: 'deferred' }); return }
    self.postMessage({ type: 'cached', modelBytes: model.bytes, runtimeBytes: runtime.bytes,
      persisted: model.persisted && runtime.persisted, fromCache: model.cached && runtime.cached }, [model.bytes, runtime.bytes])
  } catch { self.postMessage({ type: 'error' }) }
}

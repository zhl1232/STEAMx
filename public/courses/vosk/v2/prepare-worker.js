importScripts('./assets.js', './resource-cache.js')
self.onmessage = async ({ data }) => {
  if (data.type !== 'prepare') return
  try {
    // Sequential low-priority fetches avoid competing with the course for bandwidth.
    const model = await readBuildingVoiceAsset('model.tar.gz', data.allowNetwork === true)
    if (!model) { self.postMessage({ type: 'deferred' }); return }
    const runtime = await readBuildingVoiceAsset('vosk.js', data.allowNetwork === true)
    if (!runtime) { self.postMessage({ type: 'deferred' }); return }
    self.postMessage({ type: 'cached', modelBytes: model.bytes, runtimeBytes: runtime.bytes,
      persisted: model.persisted && runtime.persisted, fromCache: model.cached && runtime.cached,
      sources: [model.source, runtime.source] }, [model.bytes, runtime.bytes])
  } catch (error) { self.postMessage({ type: 'error', code: error.message === 'integrity' ? 'integrity' : 'download' }) }
}

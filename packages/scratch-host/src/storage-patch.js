import { isEmbedMode } from './asset-host.js'

/**
 * scratch-gui's storage uses a Web Worker (FetchWorkerTool) for parallel fetches.
 * Under `/scratch/` the worker chunk URL is wrong, so jobs never resolve and
 * addSprite / addBackdrop hang silently. PublicFetchWorkerTool wraps the actual
 * worker on `inner.worker` (so checking `tool.worker` would always miss it);
 * detect by Tool-interface signal instead — only the worker tool reports
 * `isSendSupported === false`.
 */
export function patchScratchStorageForEmbed(storage) {
  if (!isEmbedMode() || !storage?.webHelper?.assetTool?.tools) return

  const { assetTool } = storage.webHelper
  const isWorkerTool = (tool) => tool && tool.isSendSupported === false
  for (const tool of assetTool.tools) {
    if (!isWorkerTool(tool)) continue
    const innerWorker = tool.worker || tool.inner?.worker
    if (innerWorker?.terminate) {
      try {
        innerWorker.terminate()
      } catch {
        /* ignore */
      }
    }
  }
  assetTool.tools = assetTool.tools.filter((tool) => !isWorkerTool(tool))
}

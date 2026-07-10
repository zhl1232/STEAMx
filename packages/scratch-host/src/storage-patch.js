import { isEmbedMode } from './asset-host.js'

const WORKER_GET_TIMEOUT_MS = 12000

/**
 * scratch-storage 的 FetchWorkerTool 用嵌套 webpack publicPath `/`，
 * Worker 会去拉 `/chunks/fetch-worker-*.js`，但产物实际在 `/scratch/chunks/`。
 * 以前直接拆掉 worker 导致素材只能走主线程 FetchTool，造型/声音会慢一截。
 *
 * 这里改为：
 * 1. 尽量保留 worker（配合 next rewrite / copy-to-public 的 publicPath 修复）
 * 2. 给 worker.get 加超时，失败再回退 FetchTool，避免再次静默挂死
 */
export function patchScratchStorageForEmbed(storage) {
  if (!isEmbedMode() || !storage?.webHelper?.assetTool?.tools) return

  const { assetTool } = storage.webHelper
  const isWorkerTool = (tool) => tool && tool.isSendSupported === false

  for (const tool of assetTool.tools) {
    if (!isWorkerTool(tool)) continue
    const originalGet = tool.get?.bind(tool)
    if (typeof originalGet !== 'function') continue

    tool.get = (reqConfig) =>
      Promise.race([
        originalGet(reqConfig),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Scratch asset worker timed out')),
            WORKER_GET_TIMEOUT_MS,
          )
        }),
      ])
  }
}

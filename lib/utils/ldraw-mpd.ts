/**
 * 自托管打包 MPD：内联 `0 FILE` 块。预填 LDrawLoader 缓存并拦截 fetchData，
 * 避免 FileLoader 相对课时页 URL 去拉 parts/p/*.dat（404）。
 */

/** 把打包 MPD 拆成主模型 + 内联子文件（键为小写，与 LDrawLoader 缓存一致）。 */
export function splitPackedMpd(text: string): {
  mainName: string
  mainText: string
  embedded: Map<string, string>
} {
  const blocks = new Map<string, string>()
  let currentName: string | null = null
  let currentLines: string[] = []

  const flush = () => {
    if (!currentName) return
    blocks.set(currentName.toLowerCase(), currentLines.join('\n').trimEnd())
  }

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('0 FILE ')) {
      flush()
      currentName = line.slice('0 FILE '.length).trim()
      currentLines = []
    } else if (currentName !== null) {
      currentLines.push(line)
    }
  }
  flush()

  const mainName = text.match(/^0 FILE\s+(.+)$/m)?.[1]?.trim() ?? 'model.ldr'
  const mainKey = mainName.toLowerCase()
  const mainText = blocks.get(mainKey) ?? text
  blocks.delete(mainKey)

  return { mainName, mainText, embedded: blocks }
}

/** 为 LDrawLoader.fetchData 建立多路径别名索引（basename、parts/ 前缀等）。 */
export function buildEmbeddedLookup(embedded: Map<string, string>): Map<string, string> {
  const lookup = new Map<string, string>()

  for (const [name, text] of embedded) {
    const normalized = name.trim().replace(/\\/g, '/').toLowerCase()
    const candidates = new Set<string>([normalized])
    const basename = normalized.split('/').pop()
    if (basename) candidates.add(basename)
    if (!normalized.startsWith('parts/')) candidates.add(`parts/${normalized}`)
    if (normalized.startsWith('parts/')) candidates.add(normalized.slice('parts/'.length))
    if (normalized.startsWith('p/')) candidates.add(normalized.slice(2))
    if (normalized.startsWith('48/')) candidates.add(`p/${normalized}`)

    for (const key of candidates) {
      if (!lookup.has(key)) lookup.set(key, text)
    }
  }

  return lookup
}

/** 统计 MPD 内 `0 FILE` 块数量（含主模型）。 */
export function countEmbeddedLdrawFiles(text: string): number {
  return (text.match(/^0 FILE /gm) ?? []).length
}

/** 校验 fetch 到的内容确实是 LDraw 文本，而非 CDN 403 HTML。 */
export function assertValidLdrawMpd(text: string): void {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error(
      'LDraw MPD 加载失败: 收到 HTML 而非模型文件（请检查 /api/assets 代理或 CDN 防盗链）',
    )
  }
  if (!trimmed.startsWith('0')) {
    throw new Error('LDraw MPD 加载失败: 文件格式无效')
  }
}

/** 复刻 LDrawLoader 对 type-1 引用名的路径变换（s/ → parts/s/，48/ → p/48/）。 */
function loaderFileNameVariants(fileName: string): string[] {
  const normalized = fileName.trim().replace(/\\/g, '/').toLowerCase()
  const variants = new Set<string>([normalized])
  if (normalized.startsWith('s/')) variants.add(`parts/${normalized}`)
  if (normalized.startsWith('48/')) variants.add(`p/${normalized}`)
  variants.add(`parts/${normalized}`)
  variants.add(`p/${normalized}`)
  variants.add(`models/${normalized}`)
  const basename = normalized.split('/').pop()
  if (basename) variants.add(basename)
  if (normalized.startsWith('parts/')) variants.add(normalized.slice('parts/'.length))
  return [...variants]
}

function resolveEmbeddedText(lookup: Map<string, string>, fileName: string): string | null {
  for (const key of loaderFileNameVariants(fileName)) {
    const hit = lookup.get(key)
    if (hit !== undefined) return hit
  }
  return null
}

type LDrawParseCache = {
  setData: (fileName: string, text: string) => void
  fetchData: (fileName: string) => Promise<string>
}

/** 拦截 parseCache.fetchData，优先从内联块返回，禁止向课时页相对路径发请求。 */
export function patchParseCacheForEmbedded(
  parseCache: LDrawParseCache,
  embedded: Map<string, string>,
): void {
  const lookup = buildEmbeddedLookup(embedded)

  parseCache.fetchData = async (fileName: string) => {
    const hit = resolveEmbeddedText(lookup, fileName)
    if (hit !== null) return hit
    throw new Error(
      `LDrawLoader: 打包 MPD 缺少内联零件 "${fileName}"（共 ${embedded.size} 个内联块；请重新 pack 并上传 OSS）`,
    )
  }
}

type LDrawLoaderBase = import('three/examples/jsm/loaders/LDrawLoader.js').LDrawLoader

/** three.js 类型未暴露 partsCache，运行时有该字段。 */
type LDrawLoaderWithPartsCache = LDrawLoaderBase & {
  partsCache: {
    parseCache: LDrawParseCache
  }
}

/** 拉取打包 MPD，预填内联零件后 parse（不走 loadAsync，避免子件路径错到课时页）。 */
export async function fetchPackedLdrawText(mpdUrl: string): Promise<string> {
  const response = await fetch(mpdUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`LDraw MPD 加载失败: HTTP ${response.status} (${mpdUrl})`)
  }
  return response.text()
}

/** 从已取得的 MPD 文本 parse LDraw 模型；用于页面内调试编辑时快速重载预览。 */
export async function parsePackedLdrawModelText(
  loader: LDrawLoaderBase,
  mpdText: string,
  colorUrl: string,
): Promise<import('three').Group> {
  const packedLoader = loader as LDrawLoaderWithPartsCache
  assertValidLdrawMpd(mpdText)

  const fileBlockCount = countEmbeddedLdrawFiles(mpdText)
  const { embedded } = splitPackedMpd(mpdText)
  if (embedded.size === 0 && /\b\S+\.dat\b/i.test(mpdText)) {
    throw new Error('LDraw 模型未打包内联零件，请运行 scripts/pack-ldraw-model.mjs 后重新上传')
  }
  if (fileBlockCount <= 2 && /\b\d+\.dat\b/i.test(mpdText)) {
    throw new Error(
      `LDraw MPD 不完整（仅 ${fileBlockCount} 个 FILE 块、${embedded.size} 个内联零件）。请硬刷新（Ctrl+Shift+R）或重启 dev server`,
    )
  }

  const parseCache = packedLoader.partsCache.parseCache
  patchParseCacheForEmbedded(parseCache, embedded)

  for (const [name, fileText] of embedded) {
    parseCache.setData(name, fileText)
  }

  packedLoader.addDefaultMaterials()
  await packedLoader.preloadMaterials(colorUrl)

  // 传完整 MPD：LDrawLoader 会在 parse 时自动处理内联 0 FILE 块。
  return new Promise((resolve, reject) => {
    packedLoader.parse(mpdText, resolve, reject)
  })
}

/** 拉取打包 MPD，预填内联零件后 parse（不走 loadAsync，避免子件路径错到课时页）。 */
export async function loadPackedLdrawModel(
  loader: LDrawLoaderBase,
  mpdUrl: string,
  colorUrl: string,
): Promise<import('three').Group> {
  const mpdText = await fetchPackedLdrawText(mpdUrl)
  return parsePackedLdrawModelText(loader, mpdText, colorUrl)
}

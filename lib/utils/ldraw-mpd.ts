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

function splitMainModelSteps(mainText: string): { preamble: string; steps: string[] } {
  const sections: string[][] = [[]]

  for (const line of mainText.split(/\r?\n/)) {
    if (line.trim() === '0 STEP') {
      sections.push([])
    } else {
      sections[sections.length - 1].push(line)
    }
  }

  while (sections.length > 1 && sections[sections.length - 1].join('\n').trim() === '') {
    sections.pop()
  }

  const firstGeometryIndex = sections[0].findIndex((line) => /^[1-5]\s/.test(line.trim()))
  const preambleLines = firstGeometryIndex >= 0 ? sections[0].slice(0, firstGeometryIndex) : sections[0]
  if (firstGeometryIndex >= 0) sections[0] = sections[0].slice(firstGeometryIndex)

  return {
    preamble: preambleLines.join('\n').trimEnd(),
    steps: sections.map((lines) => lines.join('\n').trimEnd()),
  }
}

function referencedLdrawFiles(text: string): string[] {
  const references: string[] = []

  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    if (tokens[0] === '1' && tokens.length >= 15) {
      references.push(tokens.slice(14).join(' '))
    }
  }

  return references
}

const LDRAW_GEOMETRY_TOKEN_COUNTS: Readonly<Record<string, number>> = {
  '2': 8,
  '3': 11,
  '4': 14,
  '5': 14,
}

/**
 * Studio 导出的部分自定义件会在标准 type 2-5 坐标后附带 UV 等字段。
 * LDrawLoader 不读取这些尾字段，按步骤下发前剔除可减少文本传输且不改变几何。
 */
function stripUnsupportedGeometryFields(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      const tokens = trimmed.split(/\s+/)
      const standardTokenCount = LDRAW_GEOMETRY_TOKEN_COUNTS[tokens[0]]
      if (!standardTokenCount) return line

      return tokens.length > standardTokenCount
        ? tokens.slice(0, standardTokenCount).join(' ')
        : line
    })
    .join('\n')
}

function resolveEmbeddedBlock(
  embedded: Map<string, string>,
  fileName: string,
): { name: string; text: string } | null {
  for (const variant of loaderFileNameVariants(fileName)) {
    const text = embedded.get(variant)
    if (text !== undefined) return { name: variant, text }
  }
  return null
}

export function getPackedLdrawStepCount(mpdText: string): number {
  const { mainText } = splitPackedMpd(mpdText)
  return splitMainModelSteps(mainText).steps.length
}

/** 生成只含目标搭建步骤及其递归零件依赖的独立 MPD。 */
export function createPackedLdrawStep(
  mpdText: string,
  stepIndex: number,
): { mpdText: string; stepCount: number } {
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    throw new RangeError('LDraw step index must be a non-negative integer')
  }

  assertValidLdrawMpd(mpdText)
  const { mainName, mainText, embedded } = splitPackedMpd(mpdText)
  const { preamble, steps } = splitMainModelSteps(mainText)
  const stepText = steps[stepIndex]
  if (stepText === undefined) {
    throw new RangeError(`LDraw step ${stepIndex} is out of range (total ${steps.length})`)
  }

  const included = new Map<string, string>()
  const pending = referencedLdrawFiles(stepText)
  while (pending.length > 0) {
    const reference = pending.pop()
    if (!reference) continue
    const block = resolveEmbeddedBlock(embedded, reference)
    if (!block) {
      throw new Error(`LDraw MPD is missing embedded dependency "${reference}"`)
    }
    if (included.has(block.name)) continue
    included.set(block.name, stripUnsupportedGeometryFields(block.text))
    pending.push(...referencedLdrawFiles(block.text))
  }

  const mainBlock = stripUnsupportedGeometryFields(
    [preamble, stepText].filter(Boolean).join('\n'),
  )
  const blocks = [`0 FILE ${mainName}\n${mainBlock}`]
  for (const [name, text] of included) {
    blocks.push(`0 FILE ${name}\n${text}`)
  }
  return {
    mpdText: `${blocks.join('\n\n')}\n`,
    stepCount: steps.length,
  }
}

export function createPackedLdrawStepMpd(mpdText: string, stepIndex: number): string {
  return createPackedLdrawStep(mpdText, stepIndex).mpdText
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
  options?: { allowSmallPackedMpd?: boolean; preloadMaterials?: boolean },
): Promise<import('three').Group> {
  const packedLoader = loader as LDrawLoaderWithPartsCache
  assertValidLdrawMpd(mpdText)

  const fileBlockCount = countEmbeddedLdrawFiles(mpdText)
  const { embedded } = splitPackedMpd(mpdText)
  if (embedded.size === 0 && /\b\S+\.dat\b/i.test(mpdText)) {
    throw new Error('LDraw 模型未打包内联零件，请运行 scripts/pack-ldraw-model.mjs 后重新上传')
  }
  if (!options?.allowSmallPackedMpd && fileBlockCount <= 2 && /\b\d+\.dat\b/i.test(mpdText)) {
    throw new Error(
      `LDraw MPD 不完整（仅 ${fileBlockCount} 个 FILE 块、${embedded.size} 个内联零件）。请硬刷新（Ctrl+Shift+R）或重启 dev server`,
    )
  }

  const parseCache = packedLoader.partsCache.parseCache
  patchParseCacheForEmbedded(parseCache, embedded)

  for (const [name, fileText] of embedded) {
    parseCache.setData(name, fileText)
  }

  if (options?.preloadMaterials !== false) {
    packedLoader.addDefaultMaterials()
    await packedLoader.preloadMaterials(colorUrl)
  }

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

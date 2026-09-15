import { readFile } from 'node:fs/promises'
import { logger } from '@/lib/logger'
import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'
import {
  parseLdrawColorTable,
  summarizePackedLdrawBom,
  type LdrawBom,
  type LdrawColorInfo,
} from '@/lib/utils/ldraw-bom'
import {
  LdrawModelMissingError,
  isValidLdrawModelName as isValidModelName,
  readLdrawModel,
  hasLdrawModelFile as hasLdrawModelSourceFile,
  LdrawModelBusyError,
} from '@/lib/courses/ldraw-model-source'

/**
 * 服务端读取打包好的 LDraw 模型并算出零件清单。
 * 同时服务 `/api/courses/ldraw-bom`（搭建工作区按需取）和零件清单页（服务端直出给家长看）。
 */

const LDRAW_COLOR_FILE = 'LDConfig.ldr'
const MAX_CONCURRENT_BOM_TRANSFORMS = 4
const CACHE_TTL_MS = 10 * 60 * 1000

const bomCache = new BoundedTtlMap<string, LdrawBom>(64)
const bomInFlight = new Map<string, Promise<LdrawBom>>()
let colorTablePromise: Promise<Map<number, LdrawColorInfo>> | null = null

export class LdrawBomBusyError extends Error {}

/** 课时地址可以是站内或 OSS 地址，分步和清单共用同一个模型文件名。 */
export function toLdrawModelFileName(modelUrl: string | null | undefined): string | null {
  if (!modelUrl) return null
  const withoutQuery = modelUrl.split(/[?#]/)[0]
  const fileName = withoutQuery.split('/').pop() ?? ''
  return isValidModelName(fileName) ? fileName : null
}

export function isValidLdrawModelName(model: string): boolean {
  return isValidModelName(model)
}

/** Sitemap 支持本地模型及已验证上传的 OSS 模型引用。 */
export async function hasLdrawModelFile(modelUrl: string | null | undefined): Promise<boolean> {
  const model = toLdrawModelFileName(modelUrl)
  if (!model) return false

  return hasLdrawModelSourceFile(modelUrl)
}

function loadColorTable() {
  colorTablePromise ??= readFile(`${process.cwd()}/public/courses/ldraw/${LDRAW_COLOR_FILE}`, 'utf8')
    .then(parseLdrawColorTable)
    .catch(() => {
      colorTablePromise = null
      // 缺配色文件只影响颜色名，不该让整份零件清单失败。
      return new Map<number, LdrawColorInfo>()
    })
  return colorTablePromise
}

export async function loadLdrawBom(model: string): Promise<LdrawBom> {
  let source
  try { source = await readLdrawModel(model) } catch (error) {
    if (error instanceof LdrawModelBusyError) throw new LdrawBomBusyError(error.message)
    throw error
  }
  const cacheKey = `${model}:${source.sha256}`
  const cached = bomCache.get(cacheKey)
  if (cached) return cached

  const existing = bomInFlight.get(cacheKey)
  if (existing) return existing
  if (bomInFlight.size >= MAX_CONCURRENT_BOM_TRANSFORMS) {
    throw new LdrawBomBusyError('Too many LDraw part-list transforms are running')
  }

  const promise = (async () => {
    const [sourceMpd, colorTable] = await Promise.all([
      Promise.resolve(source.text),
      loadColorTable(),
    ])
    const bom = summarizePackedLdrawBom(sourceMpd, colorTable)
    bomCache.set(cacheKey, bom, Date.now() + CACHE_TTL_MS)
    return bom
  })().finally(() => {
    if (bomInFlight.get(cacheKey) === promise) bomInFlight.delete(cacheKey)
  })

  bomInFlight.set(cacheKey, promise)
  return promise
}

export type LdrawBomLookup =
  | { status: 'ok'; bom: LdrawBom }
  | { status: 'missing' }
  | { status: 'unavailable' }

/**
 * 「这节课没有模型」和「清单一时算不出来」要分开：
 * 前者永远不会有内容，后者只是并发超限或读文件失败，重试就好。
 * 零件清单页已经进了 sitemap，把后者也当 404 会让这些 URL 被搜索引擎丢掉。
 */
export async function lookupLdrawBom(modelUrl: string | null | undefined): Promise<LdrawBomLookup> {
  const model = toLdrawModelFileName(modelUrl)
  if (!model) return { status: 'missing' }

  try {
    return { status: 'ok', bom: await loadLdrawBom(model) }
  } catch (error) {
    if (error instanceof LdrawModelMissingError) return { status: 'missing' }
    logger.warn('Failed to build LDraw part list', { model, error })
    return { status: 'unavailable' }
  }
}

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { logger } from '@/lib/logger'
import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'
import {
  parseLdrawColorTable,
  summarizePackedLdrawBom,
  type LdrawBom,
  type LdrawColorInfo,
} from '@/lib/utils/ldraw-bom'

/**
 * 服务端读取打包好的 LDraw 模型并算出零件清单。
 * 同时服务 `/api/courses/ldraw-bom`（搭建工作区按需取）和零件清单页（服务端直出给家长看）。
 */

const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mpd$/
const LDRAW_DIRECTORY = path.resolve(process.cwd(), 'public/courses/ldraw')
const LDRAW_COLOR_FILE = 'LDConfig.ldr'
const MAX_LDRAW_MODEL_BYTES = 16 * 1024 * 1024
const MAX_CONCURRENT_BOM_TRANSFORMS = 4
const CACHE_TTL_MS = 10 * 60 * 1000

// 模型是随构建产物发布的静态文件，缓存键带上 mtime/size，开发期改模型也不会读到旧清单。
const bomCache = new BoundedTtlMap<string, LdrawBom>(64)
const bomInFlight = new Map<string, Promise<LdrawBom>>()
let colorTablePromise: Promise<Map<number, LdrawColorInfo>> | null = null

export class LdrawBomBusyError extends Error {}

/** 课时里的模型地址可能是站内相对路径或 OSS 绝对地址，清单只按文件名取本地打包模型。 */
export function toLdrawModelFileName(modelUrl: string | null | undefined): string | null {
  if (!modelUrl) return null
  const withoutQuery = modelUrl.split(/[?#]/)[0]
  const fileName = withoutQuery.split('/').pop() ?? ''
  return MODEL_NAME_PATTERN.test(fileName) && !fileName.includes('..') ? fileName : null
}

export function isValidLdrawModelName(model: string): boolean {
  return MODEL_NAME_PATTERN.test(model) && !model.includes('..')
}

function loadColorTable() {
  colorTablePromise ??= readFile(path.join(LDRAW_DIRECTORY, LDRAW_COLOR_FILE), 'utf8')
    .then(parseLdrawColorTable)
    .catch(() => {
      colorTablePromise = null
      // 缺配色文件只影响颜色名，不该让整份零件清单失败。
      return new Map<number, LdrawColorInfo>()
    })
  return colorTablePromise
}

export async function loadLdrawBom(model: string): Promise<LdrawBom> {
  const modelPath = path.join(LDRAW_DIRECTORY, model)
  const modelStat = await stat(modelPath)
  if (!modelStat.isFile() || modelStat.size > MAX_LDRAW_MODEL_BYTES) {
    throw new RangeError('LDraw model is too large')
  }

  const cacheKey = `${model}:${modelStat.mtimeMs}:${modelStat.size}`
  const cached = bomCache.get(cacheKey)
  if (cached) return cached

  const existing = bomInFlight.get(cacheKey)
  if (existing) return existing
  if (bomInFlight.size >= MAX_CONCURRENT_BOM_TRANSFORMS) {
    throw new LdrawBomBusyError('Too many LDraw part-list transforms are running')
  }

  const promise = (async () => {
    const [sourceMpd, colorTable] = await Promise.all([
      readFile(modelPath, 'utf8'),
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

function isMissingModelFile(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ENOENT'
}

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
    if (isMissingModelFile(error)) return { status: 'missing' }
    logger.warn('Failed to build LDraw part list', { model, error })
    return { status: 'unavailable' }
  }
}

import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { isProductionProtected, getLdrawReviewRecords, reviewStatusFor, reviewRecordFor, legacyReviewStatusFor, type LdrawReviewStatus, type LdrawReviewRecord } from './ldraw-review'

import { splitPackedMpd } from '../utils/ldraw-mpd'
import type { LdrawInspectionEntry, LdrawInspectionStatus } from './ldraw-inspection'

const SEARCH_DIRS = ['parts', 'p', 'models'] as const
const LOCAL_PART_ROOT = resolve(process.cwd(), 'scripts/ldraw-models')
const OUT_DIR = resolve(process.cwd(), 'public/courses/ldraw')

export interface LdrawModelInfo {
  name: string
  title: string
  hasMpd: boolean
  sizeBytes: number
  updatedAt: string
  category: '3+' | '4+' | '5+' | 'duplo' | 'other'
  productionProtected?: boolean
  reviewStatus: LdrawReviewStatus
  legacyReviewStatus: 'pending' | 'confirmed'
  confirmedAt: string | null
  /** Lists expose recorded inspection summaries; single-model previews verify the revision. */
  inspectionStatus?: LdrawInspectionStatus
  inspectionIssues?: string[]
}

/** 规范化引用文件名 */
function normalizeRef(ref: string): string {
  return ref.trim().replace(/\\/g, '/')
}

function isSafeLocalPartRef(normalized: string): boolean {
  return !(
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  )
}

/**
 * 复刻 LDrawLoader 解析 type-1 引用时的同款变换：
 * 归一化反斜杠后，子目录引用 s/ 前加 parts/、48/ 前加 p/。
 */
function loaderKey(ref: string): string {
  const normalized = normalizeRef(ref)
  if (normalized.startsWith('s/')) return `parts/${normalized}`
  if (normalized.startsWith('48/')) return `p/${normalized}`
  return normalized
}

/** 从一行 LDraw 文本里解析子文件引用（type 1 行的最后一个字段）。 */
function extractRef(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('1 ')) return null
  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 15) return null
  return tokens.slice(14).join(' ')
}

function normalizeLDrawText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '')
}

function normalizeSourceModelText(text: string): string {
  return normalizeLDrawText(text)
    .replace(/^0 FILE[^\n]*(?:\n)?/, '')
    .replace(/(?:^|\n)0 NOFILE\s*$/, '')
}

/** 内存中缓存已打包 MPD 里的内联零件，避免每次请求重复扫描磁盘 */
let cachedMpdParts: Map<string, string> | null = null
let cachedMpdTimestamp = 0
const MPD_CACHE_TTL_MS = 60 * 1000

async function loadLocalMpdCache(forceRefresh = false): Promise<Map<string, string>> {
  const now = Date.now()
  if (!forceRefresh && cachedMpdParts && now - cachedMpdTimestamp < MPD_CACHE_TTL_MS) {
    return cachedMpdParts
  }

  const cache = new Map<string, string>()
  let files: string[] = []
  try {
    files = await readdir(OUT_DIR)
  } catch {
    return cache
  }

  for (const file of files) {
    if (!file.endsWith('.mpd')) continue

    try {
      const text = normalizeLDrawText(await readFile(resolve(OUT_DIR, file), 'utf8'))
      const lines = text.split(/\n/)
      let currentName: string | null = null
      let currentLines: string[] = []

      const flush = () => {
        if (!currentName || currentLines.length === 0) return
        const key = currentName.toLowerCase()
        if (!cache.has(key)) cache.set(key, currentLines.join('\n').trimEnd())
      }

      for (const line of lines) {
        if (line.startsWith('0 FILE ')) {
          flush()
          currentName = line.slice('0 FILE '.length).trim()
          currentLines = []
          continue
        }
        if (currentName) currentLines.push(line)
      }
      flush()
    } catch {
      // 忽略单个 MPD 读取错误
    }
  }

  cachedMpdParts = cache
  cachedMpdTimestamp = now
  return cache
}

/** 在本地候选子目录（parts/、p/、models/）查找零件 */
async function resolveLocalPart(ref: string): Promise<string | null> {
  const normalized = normalizeRef(ref)
  // Type-1 references are filenames within one of the trusted LDraw roots.
  // Reject absolute and parent-directory references before resolving them so
  // `path.resolve` cannot turn an attacker-controlled reference into an
  // arbitrary server path.
  if (!isSafeLocalPartRef(normalized)) return null

  let realLocalRoot: string
  try {
    realLocalRoot = await realpath(/*turbopackIgnore: true*/ LOCAL_PART_ROOT)
  } catch {
    return null
  }

  for (const dir of SEARCH_DIRS) {
    try {
      const trustedRoot = await realpath(/*turbopackIgnore: true*/ resolve(realLocalRoot, dir))
      if (trustedRoot !== realLocalRoot && !trustedRoot.startsWith(`${realLocalRoot}/`)) {
        continue
      }
      const realLocalPath = await realpath(/*turbopackIgnore: true*/ resolve(trustedRoot, normalized))
      if (realLocalPath !== trustedRoot && !realLocalPath.startsWith(`${trustedRoot}/`)) {
        continue
      }
      const content = normalizeLDrawText(await readFile(realLocalPath, 'utf8'))
      return content
    } catch {
      // 继续尝试下一个候选目录
    }
  }
  return null
}

/** 解析单个零件内容：优先查找本地 parts/p/models，再查已打包 MPD 缓存 */
async function resolvePartContent(
  ref: string,
  context: LdrawPackingContext,
): Promise<string | null> {
  if (!isSafeLocalPartRef(normalizeRef(ref))) return null
  const local = await resolveLocalPart(ref)
  if (local !== null) return local

  const localMpdCache = await context.getLocalMpdCache()
  const key = loaderKey(ref).toLowerCase()
  const cached = localMpdCache.get(key)
  if (cached) return cached

  // 尝试裸文件名匹配
  const baseName = ref.split(/[\\/]/).pop()?.toLowerCase()
  if (baseName && localMpdCache.has(baseName)) {
    return localMpdCache.get(baseName) ?? null
  }

  return null
}

interface LdrawPackingContext {
  getLocalMpdCache: () => Promise<Map<string, string>>
  resolvedParts: Map<string, Promise<string | null>>
}

function createPackingContext(forceFreshDependencies = false): LdrawPackingContext {
  let localMpdCache: Promise<Map<string, string>> | undefined
  return {
    // Local DAT files usually satisfy every reference. Only scan published MPDs
    // for a missing dependency, sharing even concurrent fallback reads per request.
    getLocalMpdCache: () => localMpdCache ??= loadLocalMpdCache(forceFreshDependencies),
    resolvedParts: new Map(),
  }
}

function resolvePartContentWithContext(ref: string, context: LdrawPackingContext): Promise<string | null> {
  const key = normalizeRef(ref)
  const cached = context.resolvedParts.get(key)
  if (cached) return cached

  const promise = resolvePartContent(ref, context)
  context.resolvedParts.set(key, promise)
  return promise
}

export interface PackResult {
  mpdText: string
  partCount: number
  missingParts: string[]
  stepCount: number
  revision: string
}

/** Read only the exact published bytes approved by the review record; never repack them. */
export async function readFrozenConfirmedLdrawModel(fileName: string, record?: LdrawReviewRecord | null): Promise<PackResult | null> {
  if (!record || !/^[a-zA-Z0-9._-]+\.ldr$/.test(fileName)) return null
  let bytes: Buffer
  try {
    bytes = await readFile(resolve(OUT_DIR, fileName.replace(/\.ldr$/, '.mpd')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return null
  }
  const revision = createHash('sha256').update(bytes).digest('hex')
  if (revision !== record.revision) return null
  const mpdText = bytes.toString('utf8')
  const { mainText, embedded } = splitPackedMpd(mpdText)
  return {
    mpdText,
    revision,
    stepCount: mainText.split(/\r?\n/).filter((line) => line.trim() === '0 STEP').length + 1,
    partCount: embedded.size,
    missingParts: [],
  }
}

/**
 * 将任意 LDR 源码文本打包为自托管 MPD 字符串（内联依赖零件和图元）。
 */
export async function packLdrawTextToMpd(
  ldrSource: string,
  modelName = 'preview-model',
  options?: { forceFreshDependencies?: boolean },
): Promise<PackResult> {
  return packLdrawTextToMpdWithContext(ldrSource, modelName, createPackingContext(options?.forceFreshDependencies))
}

async function packLdrawTextToMpdWithContext(
  ldrSource: string,
  modelName: string,
  context: LdrawPackingContext,
): Promise<PackResult> {
  const normalizedModel = normalizeSourceModelText(ldrSource)

  const collected = new Map<string, string>()
  const visited = new Set<string>()
  const missingParts: string[] = []

  async function walk(text: string) {
    const refs: string[] = []
    for (const line of text.split(/\r?\n/)) {
      const ref = extractRef(line)
      if (ref) refs.push(ref)
    }

    for (const ref of refs) {
      const key = loaderKey(ref).toLowerCase()
      if (visited.has(key)) continue
      visited.add(key)

      const content = await resolvePartContentWithContext(ref, context)
      if (content !== null) {
        collected.set(loaderKey(ref), content)
        await walk(content)
      } else {
        missingParts.push(ref)
      }
    }
  }

  await walk(normalizedModel)

  // 计算步骤数（按 0 STEP 拆分）
  const steps = normalizedModel.split(/\r?\n/).filter((line) => line.trim() === '0 STEP')
  const stepCount = steps.length + 1

  // 组装 MPD：主模型置顶，随后为内联子零件
  const blocks = [`0 FILE ${modelName}.ldr\n${normalizedModel.trimEnd()}\n`]
  for (const [ref, content] of collected) {
    blocks.push(`0 FILE ${ref}\n${content.trimEnd()}\n`)
  }

  return {
    mpdText: blocks.join('\n'),
    partCount: collected.size,
    missingParts: Array.from(new Set(missingParts)),
    stepCount,
    revision: createHash('sha256').update(blocks.join('\n'), 'utf8').digest('hex'),
  }
}

/**
 * 获取 scripts/ldraw-models/ 下的所有 LDR 源模型及其元信息
 * verifyRevisions:false returns saved summaries without packing dependencies or
 * reading frozen MPDs; the selected-model preview remains the revision authority.
 */
export async function listAllLdrawModels(
  reviewRecords?: Record<string, LdrawReviewRecord>,
  options?: { verifyRevisions?: boolean; inspections?: Record<string, LdrawInspectionEntry> },
): Promise<LdrawModelInfo[]> {
  const ldrFiles = (await readdir(LOCAL_PART_ROOT)).filter((f) => f.endsWith('.ldr'))
  reviewRecords ??= await getLdrawReviewRecords()

  let mpdSet = new Set<string>()
  try {
    const mpdFiles = await readdir(OUT_DIR)
    mpdSet = new Set(mpdFiles.filter((f) => f.endsWith('.mpd')).map((f) => f.replace(/\.mpd$/, '')))
  } catch {
    // MPD 目录不存在或读取失败
  }

  const results: LdrawModelInfo[] = await Promise.all(ldrFiles.map(async (file) => {
    const base = file.replace(/\.ldr$/, '')
    const filePath = resolve(LOCAL_PART_ROOT, file)

    let title = base
    let sizeBytes = 0
    let updatedAt = new Date().toISOString()

    try {
      const fileStat = await stat(filePath)
      sizeBytes = fileStat.size
      updatedAt = fileStat.mtime.toISOString()

      // 读取首行标题（如果存在注释）
      const head = await readFile(filePath, 'utf8')
      const firstLine = head.split(/\r?\n/)[0]?.trim() ?? ''
      if (firstLine.startsWith('0 ')) {
        title = firstLine.slice(2).trim()
      }
    } catch {
      // 保持默认
    }

    let category: LdrawModelInfo['category'] = 'other'
    if (file.startsWith('3-')) category = '3+'
    else if (file.startsWith('4-')) category = '4+'
    else if (file.startsWith('5-')) category = '5+'
    else if (file.toLowerCase().includes('duplo')) category = 'duplo'

    const stored = reviewRecordFor(file, reviewRecords)
    const inspection = options?.inspections?.[file]
    const reviewStatus = reviewStatusFor(file, reviewRecords, inspection?.revision ?? stored?.revision)
    return {
      name: file,
      title,
      hasMpd: mpdSet.has(base),
      sizeBytes,
      updatedAt,
      category,
      productionProtected: Boolean(stored && isProductionProtected(file)),
      reviewStatus,
      legacyReviewStatus: legacyReviewStatusFor(reviewStatus),
      confirmedAt: stored?.confirmedAt ?? null,
      inspectionStatus: inspection?.status ?? (stored ? 'exempt' : 'unchecked'),
      inspectionIssues: inspection?.issues ?? [],
    }
  }))

  if (options?.verifyRevisions !== false) {
    const context = createPackingContext(true)
    await Promise.all(results.map(async (item) => {
      const stored = reviewRecordFor(item.name, reviewRecords)
      try {
        const frozen = await readFrozenConfirmedLdrawModel(item.name, stored)
        const revision = stored && !frozen
          ? (await packLocalLdrawModelWithContext(item.name, context)).revision
          : undefined
        item.reviewStatus = reviewStatusFor(item.name, reviewRecords, revision, frozen?.revision)
      } catch {
        item.reviewStatus = reviewStatusFor(item.name, reviewRecords)
      }
      item.legacyReviewStatus = legacyReviewStatusFor(item.reviewStatus)
    }))
  }

  // 排序：有 MPD 的排在前面，同状态按文件名排序
  return results.sort((a, b) => {
    if (a.hasMpd !== b.hasMpd) return a.hasMpd ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

/**
 * 直接从本地读取指定 LDR 文件并打包返回
 */
export async function packLocalLdrawModel(fileName: string, options?: { forceFreshDependencies?: boolean }): Promise<PackResult> {
  return packLocalLdrawModelWithContext(fileName, createPackingContext(options?.forceFreshDependencies))
}

async function packLocalLdrawModelWithContext(
  fileName: string,
  context: LdrawPackingContext,
): Promise<PackResult> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!sanitized.endsWith('.ldr')) {
    throw new Error('文件名必须以 .ldr 结尾')
  }

  const realLocalRoot = await realpath(/*turbopackIgnore: true*/ LOCAL_PART_ROOT)
  const filePath = await realpath(/*turbopackIgnore: true*/ resolve(realLocalRoot, sanitized))
  if (filePath !== realLocalRoot && !filePath.startsWith(`${realLocalRoot}/`)) {
    throw new Error('模型文件必须位于本地模型目录内')
  }
  const ldrSource = await readFile(filePath, 'utf8')
  const baseName = sanitized.replace(/\.ldr$/, '')

  return packLdrawTextToMpdWithContext(ldrSource, baseName, context)
}

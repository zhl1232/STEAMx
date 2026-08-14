import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'
import {
  parseLdrawColorTable,
  summarizePackedLdrawBom,
  type LdrawBom,
  type LdrawColorInfo,
} from '@/lib/utils/ldraw-bom'

export const runtime = 'nodejs'

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

class LdrawBomBusyError extends Error {}

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

async function loadBom(model: string): Promise<LdrawBom> {
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

/** 大颗粒课程零件清单：按模型 `0 STEP` 给出每步新增零件与整课总数。 */
export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get('model') ?? ''

  if (!MODEL_NAME_PATTERN.test(model) || model.includes('..')) {
    return NextResponse.json({ error: 'Invalid LDraw model name' }, { status: 400 })
  }

  try {
    const bom = await loadBom(model)
    return NextResponse.json(bom, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof LdrawBomBusyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '1' } },
      )
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'LDraw model not found' }, { status: 404 })
    }
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    return NextResponse.json({ error: 'Unable to build LDraw part list' }, { status: 500 })
  }
}

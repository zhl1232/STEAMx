import { NextRequest, NextResponse } from 'next/server'
import {
  listAllLdrawModels,
  packLdrawTextToMpd,
  packLocalLdrawModel,
  readFrozenConfirmedLdrawModel,
} from '@/lib/courses/ldraw-packer'
import {
  isProductionProtected,
  confirmLdrawModel,
  getLdrawReviewRecords,
  isLdrawReviewCandidate,
  reviewRecordFor,
  reviewStatusFor,
  legacyReviewStatusFor,
} from '@/lib/courses/ldraw-review'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get('model')

  try {
    if (model) {
      const sanitized = model.trim()
      if (!sanitized.endsWith('.ldr') || sanitized.includes('/') || sanitized.includes('\\')) {
        return NextResponse.json({ error: '无效的模型文件名' }, { status: 400 })
      }

      const result = await packLocalLdrawModel(sanitized, { forceFreshDependencies: true })
      const records = await getLdrawReviewRecords()
      const record = reviewRecordFor(sanitized, records)
      const frozen = result.revision !== record?.revision
        ? await readFrozenConfirmedLdrawModel(sanitized, record)
        : null
      const reviewStatus = reviewStatusFor(sanitized, records, result.revision, frozen?.revision)
      return NextResponse.json(
        {
          modelName: sanitized.replace(/\.ldr$/, ''),
          fileName: sanitized,
          ...(frozen ?? result),
          productionProtected: Boolean(record && isProductionProtected(sanitized)),
          servedFrozenConfirmed: frozen !== null,
          reviewStatus,
          legacyReviewStatus: legacyReviewStatusFor(reviewStatus),
          confirmedAt: record?.confirmedAt ?? null,
          canConfirm: process.env.NODE_ENV !== 'production' && reviewStatus !== 'confirmed' && isLdrawReviewCandidate(sanitized) && result.missingParts.length === 0,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      )
    }

    const records = await getLdrawReviewRecords()
    const models = await listAllLdrawModels(records)
    return NextResponse.json(
      {
        models,
        total: models.length,
        reviewRecordCount: Object.keys(records).length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    )
  } catch (error) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || '获取 LDraw 模型数据失败' },
      { status: 500 },
    )
  }
}

function canWriteReview(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    const loopback = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1' || originUrl.hostname === '[::1]' || originUrl.hostname === '::1'
    return loopback && originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ldrText, modelName = 'custom-model' } = body ?? {}

    if (typeof ldrText !== 'string' || !ldrText.trim()) {
      return NextResponse.json({ error: '请提供有效的 LDR 文本内容' }, { status: 400 })
    }

    const result = await packLdrawTextToMpd(ldrText, modelName)
    return NextResponse.json({
      modelName,
      ...result,
    })
  } catch (error) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || '即时打包 LDraw 失败' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (!canWriteReview(request)) {
    return NextResponse.json({ error: '仅允许本地开发环境确认模型' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const model = typeof body?.model === 'string' ? body.model.trim() : ''
    const revision = typeof body?.revision === 'string' ? body.revision.trim() : ''
    if (!model || !model.endsWith('.ldr') || model.includes('/') || model.includes('\\') || !revision) {
      return NextResponse.json({ error: '请提供有效的模型和版本' }, { status: 400 })
    }
    if (!isLdrawReviewCandidate(model)) {
      return NextResponse.json({ error: '该模型不在修复确认清单中' }, { status: 404 })
    }

    const current = await packLocalLdrawModel(model, { forceFreshDependencies: true })
    if (current.missingParts.length > 0) {
      return NextResponse.json({ error: '模型仍缺少依赖，无法确认', missingParts: current.missingParts }, { status: 409 })
    }
    if (current.revision !== revision) {
      return NextResponse.json({ error: '模型内容已变化，请重新载入后确认', revision: current.revision }, { status: 409 })
    }

    const record = await confirmLdrawModel(model, current.revision)
    return NextResponse.json({ model, revision: current.revision, reviewStatus: 'confirmed', legacyReviewStatus: 'confirmed', confirmedAt: record.confirmedAt, reviewRecordCount: Object.keys(await getLdrawReviewRecords()).length })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message || '确认模型失败' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { isDevelopmentMode } from '@/lib/development-only'
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
import { getLdrawInspectionRecords, inspectionFor } from '@/lib/courses/ldraw-inspection'

export const runtime = 'nodejs'

function unavailable() {
  return NextResponse.json({ error: 'Not Found' }, {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export async function GET(request: NextRequest) {
  if (!isDevelopmentMode()) return unavailable()
  const model = request.nextUrl.searchParams.get('model')
  const draft = request.nextUrl.searchParams.get('source') === 'draft'

  try {
    if (model) {
      const sanitized = model.trim()
      if (!sanitized.endsWith('.ldr') || sanitized.includes('/') || sanitized.includes('\\')) {
        return NextResponse.json({ error: '无效的模型文件名' }, { status: 400 })
      }

      const [result, records, inspections] = await Promise.all([
        packLocalLdrawModel(sanitized, { forceFreshDependencies: true }),
        getLdrawReviewRecords(),
        getLdrawInspectionRecords(),
      ])
      const record = reviewRecordFor(sanitized, records)
      const frozen = !draft && result.revision !== record?.revision
        ? await readFrozenConfirmedLdrawModel(sanitized, record)
        : null
      const reviewStatus = draft && record && result.revision !== record.revision
        ? 'changed'
        : reviewStatusFor(sanitized, records, result.revision, frozen?.revision)
      const inspection = inspectionFor(sanitized, result.revision, inspections, record !== null)
      return NextResponse.json(
        {
          modelName: sanitized.replace(/\.ldr$/, ''),
          fileName: sanitized,
          ...(frozen ?? result),
          productionProtected: Boolean(record && isProductionProtected(sanitized)),
          servedFrozenConfirmed: frozen !== null,
          servedDraft: draft,
          reviewStatus,
          legacyReviewStatus: legacyReviewStatusFor(reviewStatus),
          confirmedAt: record?.confirmedAt ?? null,
          inspectionStatus: inspection.status,
          inspectionIssues: inspection.issues,
          inspectionNotes: inspection.notes,
          inspectionRevision: inspection.revision,
          canConfirm: isDevelopmentMode() && !isProductionProtected(sanitized) && reviewStatus !== 'confirmed' && isLdrawReviewCandidate(sanitized) && result.missingParts.length === 0 && (inspection.status === 'checked' || inspection.status === 'exempt'),
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      )
    }

    const [records, inspections] = await Promise.all([
      getLdrawReviewRecords(),
      getLdrawInspectionRecords(),
    ])
    const models = await listAllLdrawModels(records, { verifyRevisions: false, inspections })
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
  if (!isDevelopmentMode()) return unavailable()
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
  if (!isDevelopmentMode()) return unavailable()
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

    if (isProductionProtected(model)) {
      return NextResponse.json({ error: '该模型保留线上已确认版本，不能覆盖确认记录', code: 'LDRAW_PRODUCTION_PROTECTED' }, { status: 409 })
    }

    const current = await packLocalLdrawModel(model, { forceFreshDependencies: true })
    if (current.missingParts.length > 0) {
      return NextResponse.json({ error: '模型仍缺少依赖，无法确认', missingParts: current.missingParts }, { status: 409 })
    }
    if (current.revision !== revision) {
      return NextResponse.json({ error: '模型内容已变化，请重新载入后确认', revision: current.revision }, { status: 409 })
    }

    const records = await getLdrawReviewRecords()
    const existingRecord = reviewRecordFor(model, records)
    if (!existingRecord) {
      const inspection = inspectionFor(model, current.revision, await getLdrawInspectionRecords(), false)
      if (inspection.status !== 'checked') {
        const needsRepair = inspection.status === 'needs-repair'
        return NextResponse.json({
          error: needsRepair ? '该模型当前版本仍需修复，暂不能确认' : '该模型当前版本尚未完成检查，暂不能确认',
          code: needsRepair ? 'LDRAW_INSPECTION_NEEDS_REPAIR' : 'LDRAW_INSPECTION_REQUIRED',
          inspectionStatus: inspection.status,
          inspectionIssues: inspection.issues,
          inspectionRevision: inspection.revision,
        }, { status: 409 })
      }
    }

    const record = await confirmLdrawModel(model, current.revision)
    return NextResponse.json({ model, revision: current.revision, reviewStatus: 'confirmed', legacyReviewStatus: 'confirmed', confirmedAt: record.confirmedAt, reviewRecordCount: Object.keys(await getLdrawReviewRecords()).length })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message || '确认模型失败' }, { status: 500 })
  }
}

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

import { createClient } from '@/lib/supabase/server'
import { AuthError, PermissionError, requireRole } from '@/lib/api/auth'

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

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

function configuredConfirmOrigins(): string[] {
  return (process.env.LDRAW_CONFIRM_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * 判断确认请求来源：
 * - 'local'：本机同源请求（原有行为，无需登录）
 * - 'remote'：LDRAW_CONFIRM_ALLOWED_ORIGINS 中配置的来源（如 https://dev.steamx.cc），必须是管理员
 * - null：拒绝。生产环境（NODE_ENV=production）一律拒绝，与原有行为一致。
 */
function confirmOriginKind(request: NextRequest): 'local' | 'remote' | null {
  if (process.env.NODE_ENV === 'production') return null
  const origin = request.headers.get('origin')
  if (!origin) return null
  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    if (isLoopbackHost(originUrl.hostname) && originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host) {
      return 'local'
    }
    if (originUrl.protocol === 'https:' && configuredConfirmOrigins().includes(originUrl.origin)) {
      return 'remote'
    }
    return null
  } catch {
    return null
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
  const originKind = confirmOriginKind(request)
  if (!originKind) {
    return NextResponse.json({ error: '仅允许开发环境确认模型' }, { status: 403 })
  }
  if (originKind === 'remote') {
    try {
      const supabase = await createClient()
      await requireRole(supabase, ['admin'])
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: '请先登录管理员账号再确认模型', code: 'LDRAW_CONFIRM_LOGIN_REQUIRED' }, { status: 401 })
      }
      if (error instanceof PermissionError) {
        return NextResponse.json({ error: '只有管理员账号可以确认模型', code: 'LDRAW_CONFIRM_ADMIN_REQUIRED' }, { status: 403 })
      }
      return NextResponse.json({ error: '校验管理员身份失败' }, { status: 500 })
    }
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

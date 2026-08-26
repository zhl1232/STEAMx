import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateNumber, ValidationError } from '@/lib/api/validation'
import {
  buildAdminCandidate,
  getAdminContentTypes,
  loadAdminContentRow,
  mapAdminRow,
  updateAdminDifficultyStars,
  type AdminContentType,
} from '@/lib/content-classification/admin'
import { validateClassificationInput, isSupportLevel } from '@/lib/content-classification/validation'
import type { ClassificationInput } from '@/lib/content-classification/types'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ contentType: string; id: string }> }

function resolveType(raw: string): AdminContentType {
  const [type] = getAdminContentTypes(raw)
  if (!type) throw new ValidationError('contentType must be course, project, or challenge')
  return type
}

function readNullableInteger(body: Record<string, unknown>, key: string, current: number | null): number | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return current
  if (body[key] === null || body[key] === '') return null
  return validateNumber(body[key], key, { min: 3, max: 16, integer: true })
}

function readNullableSupport(body: Record<string, unknown>, current: string | null): ClassificationInput['supportLevel'] {
  if (!Object.prototype.hasOwnProperty.call(body, 'supportLevel')) return isSupportLevel(current) ? current : null
  if (body.supportLevel === null || body.supportLevel === '') return null
  if (!isSupportLevel(body.supportLevel)) throw new ValidationError('supportLevel is invalid')
  return body.supportLevel
}

function readDifficultyStars(body: Record<string, unknown>, current: number | null): number | null {
  if (!Object.prototype.hasOwnProperty.call(body, 'difficultyStars')) return current
  if (body.difficultyStars === null || body.difficultyStars === '') return null
  return validateNumber(body.difficultyStars, 'difficultyStars', { min: 1, max: 6, integer: true })
}

function rpcErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const { contentType: rawType, id: rawId } = await params
    const contentType = resolveType(rawType)
    const id = validateNumber(rawId, 'id', { min: 1, integer: true })
    const [{ data: row, error: rowError }, { data: history, error: historyError }] = await Promise.all([
      loadAdminContentRow(supabase, contentType, id, true),
      supabase
        .from('content_classification_reviews')
        .select('*')
        .eq('content_type', contentType)
        .eq('content_id', id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (rowError) throw rowError
    if (historyError) throw historyError
    if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

    return NextResponse.json({
      contentType,
      id,
      content: row,
      classification: mapAdminRow(row),
      candidate: buildAdminCandidate(row),
      history: history ?? [],
      inheritance: contentType === 'course'
        ? { source: 'course', description: '课程三轴会由所有课时继承，课时不单独存储分级。' }
        : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const { contentType: rawType, id: rawId } = await params
    const contentType = resolveType(rawType)
    const id = validateNumber(rawId, 'id', { min: 1, integer: true })
    const body = await request.json() as Record<string, unknown>
    const forbidden = ['classificationStatus', 'classificationReviewedAt', 'classificationReviewedBy']
    if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
      throw new ValidationError('审核状态和审核元数据只能通过 review 接口写入')
    }

    const { data: row, error: rowError } = await loadAdminContentRow(supabase, contentType, id)
    if (rowError) throw rowError
    if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

    const input: ClassificationInput = {
      recommendedMinAge: readNullableInteger(body, 'recommendedMinAge', typeof row.recommended_min_age === 'number' ? row.recommended_min_age : null),
      recommendedMaxAge: readNullableInteger(body, 'recommendedMaxAge', typeof row.recommended_max_age === 'number' ? row.recommended_max_age : null),
      supportLevel: readNullableSupport(body, typeof row.support_level === 'string' ? row.support_level : null),
      difficultyStars: readDifficultyStars(body, typeof row.difficulty_stars === 'number' ? row.difficulty_stars : null),
    }
    if (!Object.keys(body).some((key) => ['recommendedMinAge', 'recommendedMaxAge', 'supportLevel', 'difficultyStars'].includes(key))) {
      throw new ValidationError('至少提供一个候选分级字段')
    }
    const validation = validateClassificationInput(input)
    if (!validation.valid) throw new ValidationError(validation.errors.join('; '))

    if (input.difficultyStars !== row.difficulty_stars) {
      if (input.difficultyStars === null) throw new ValidationError('difficultyStars 不能置空，内部难度必须保留 1-6')
      const result = await updateAdminDifficultyStars(supabase, contentType, id, input.difficultyStars)
      if (result.error) throw result.error
    }

    const { data: candidateResult, error: candidateError } = await callRpc(supabase, 'set_content_classification_candidate', {
      p_content_type: contentType,
      p_content_id: id,
      p_min_age: input.recommendedMinAge,
      p_max_age: input.recommendedMaxAge,
      p_support_level: input.supportLevel,
    })
    if (candidateError) throw candidateError

    const { data: updated, error: updatedError } = await loadAdminContentRow(supabase, contentType, id)
    if (updatedError) throw updatedError
    return NextResponse.json({ contentType, id, content: updated, classification: updated ? mapAdminRow(updated) : null, candidateResult })
  } catch (error) {
    const code = rpcErrorCode(error)
    if (code === 'P0002') return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    return handleApiError(error)
  }
}

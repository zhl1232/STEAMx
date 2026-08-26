import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateNumber, validateUUID, ValidationError } from '@/lib/api/validation'
import { getAdminContentTypes, loadAdminContentRow, type AdminContentType } from '@/lib/content-classification/admin'
import { isSupportLevel, validateClassificationInput } from '@/lib/content-classification/validation'
import type { ClassificationInput } from '@/lib/content-classification/types'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ contentType: string; id: string }> }

function resolveType(raw: string): AdminContentType {
  const [type] = getAdminContentTypes(raw)
  if (!type) throw new ValidationError('contentType must be course, project, or challenge')
  return type
}

function errorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  try {
    const { user } = await requireRole(supabase, ['moderator', 'admin'])
    const { contentType: rawType, id: rawId } = await params
    const contentType = resolveType(rawType)
    const id = validateNumber(rawId, 'id', { min: 1, integer: true })
    const body = await request.json() as Record<string, unknown>
    const decision = validateEnum(body.decision, 'decision', ['approve', 'return'] as const)
    const idempotencyKey = validateUUID(body.idempotencyKey, 'idempotencyKey')
    const { data: row, error: rowError } = await loadAdminContentRow(supabase, contentType, id)
    if (rowError) throw rowError
    if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

    const input: ClassificationInput = {
      recommendedMinAge: body.recommendedMinAge === null ? null : validateNumber(body.recommendedMinAge, 'recommendedMinAge', { min: 3, max: 16, integer: true }),
      recommendedMaxAge: body.recommendedMaxAge === null ? null : validateNumber(body.recommendedMaxAge, 'recommendedMaxAge', { min: 3, max: 16, integer: true }),
      supportLevel: isSupportLevel(body.supportLevel) ? body.supportLevel : null,
      difficultyStars: validateNumber(body.difficultyStars, 'difficultyStars', { min: 1, max: 6, integer: true }),
    }
    if (!input.supportLevel) throw new ValidationError('supportLevel is required')
    const validation = validateClassificationInput(input)
    if (!validation.valid) throw new ValidationError(validation.errors.join('; '))
    if (input.recommendedMinAge === null || input.difficultyStars === null || input.supportLevel === null) {
      throw new ValidationError('审核必须提供完整的年龄、难度和成人支持度')
    }
    const minAge = input.recommendedMinAge
    const difficultyStars = input.difficultyStars
    const supportLevel = input.supportLevel

    const expectedRevision = body.expectedRevision === undefined
      ? (typeof row.classification_revision === 'number' ? row.classification_revision : 0)
      : validateNumber(body.expectedRevision, 'expectedRevision', { min: 0, integer: true })
    const { data, error } = await callRpc(supabase, 'review_content_classification', {
      p_content_type: contentType,
      p_content_id: id,
      p_expected_revision: expectedRevision,
      p_decision: decision,
      p_min_age: minAge,
      p_max_age: input.recommendedMaxAge,
      p_support_level: supportLevel,
      p_difficulty_stars: difficultyStars,
      p_note: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null,
      p_idempotency_key: idempotencyKey,
      p_reviewer_id: user.id,
    })
    if (error) throw error

    const { data: updated, error: updatedError } = await loadAdminContentRow(supabase, contentType, id)
    if (updatedError) throw updatedError
    return NextResponse.json({ contentType, id, decision, result: data, content: updated })
  } catch (error) {
    const code = errorCode(error)
    const message = String((error as { message?: string }).message || '')
    if (code === '42501' && message.includes('SELF_REVIEW_FORBIDDEN')) {
      return NextResponse.json({ error: '审核员不能审核自己创建的内容', code: 'SELF_REVIEW_FORBIDDEN' }, { status: 403 })
    }
    if (code === 'P0001' && String((error as { message?: string }).message || '').includes('CLASSIFICATION_STALE')) {
      return NextResponse.json({ error: '内容已被修改，请刷新后重新审核', code: 'CLASSIFICATION_STALE' }, { status: 409 })
    }
    if (code === 'P0002') return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    if (code === '42501') return NextResponse.json({ error: '没有审核权限' }, { status: 403 })
    return handleApiError(error)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { SubmitCompletionSchema } from '@/lib/project/record-input'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import {
  isOwnedCompletionVideoUrl,
  isOwnedProjectImageUrl,
  validateContentSafeIfPresent,
  validateNumber,
} from '@/lib/api/validation'
import { scheduleCompletionModeration } from '@/lib/completions/moderate-completion'
import { getProjectCompletions } from '@/lib/api/explore-data'
import {
  ensureJourney,
  syncLegacyProjectRecord,
  upsertJourneyRecord,
} from '@/lib/journeys/service'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createModerationCase, moderateUserContent } from '@/lib/safety/server'

const GALLERY_LIMIT = 24

/**
 * GET /api/projects/[id]/completions
 * 公开作品列表（is_public + approved 的终稿），用于课程工作区「作品」Tab 等就地展示。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })
    const completions = await getProjectCompletions(projectId, GALLERY_LIMIT, {
      sortBy: 'featured',
      onePerUser: true,
    })
    return NextResponse.json({ completions })
  } catch (error) {
    return handleApiError(error)
  }
}



/**
 * POST /api/projects/[id]/completions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })

    const body = await request.json()
    const parsed = SubmitCompletionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const payload = parsed.data
    const recordKind = payload.kind
    // This POST is an explicit publish request; unpublished recovery stays local.
    await requireInteractionAccess(supabase, user, 'submit')

    validateContentSafeIfPresent(payload.recordType, '记录类型')
    validateContentSafeIfPresent(payload.stageLabel, '阶段名称')
    validateContentSafeIfPresent(payload.notes, '作品说明')
    for (const caption of payload.imageCaptions ?? []) {
      validateContentSafeIfPresent(caption, '图片说明')
    }

    if (
      payload.images.some(
        (url) => !isOwnedProjectImageUrl(url, user.id, { bucket: 'project-completions' }),
      )
    ) {
      return NextResponse.json({ error: '作品图片必须使用当前账号上传的文件' }, { status: 400 })
    }

    if (payload.videoUrl && !isOwnedCompletionVideoUrl(payload.videoUrl, user.id)) {
      return NextResponse.json({ error: '作品视频必须使用当前账号上传的文件' }, { status: 400 })
    }

    const moderation = await moderateUserContent({
      text: [payload.notes, ...(payload.imageCaptions || [])].filter((value): value is string => Boolean(value?.trim())).join('\n'),
      imageSources: payload.images,
    })
    if (moderation.state === 'rejected') {
      return NextResponse.json(
        { error: moderation.reason || '作品未通过安全检查', code: 'CONTENT_REJECTED' },
        { status: 422 },
      )
    }
    if (moderation.state === 'pending' && !supabaseAdmin) {
      return NextResponse.json(
        { error: '审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const journey = await ensureJourney(supabase, {
      userId: user.id,
      sourceType: 'project',
      sourceId: projectId,
    })
    const record = await upsertJourneyRecord(supabase, journey.id, user.id, {
      recordKind,
      anchorType: 'extra',
      title: recordKind === 'final' ? undefined : '探索记录',
      notes: payload.notes || null,
      images: payload.images,
      imageCaptions: payload.imageCaptions?.length ? payload.imageCaptions : null,
      videoUrl: payload.videoUrl || null,
      data: {
        recordType: payload.recordType || null,
        stageLabel: payload.stageLabel || null,
      },
      visibility: 'public',
      moderationState: moderation.state,
      moderationSource: moderation.modelName || 'ai',
    })

    const legacyId = await syncLegacyProjectRecord(supabase, journey, record)

    if (recordKind === 'final') {
      if (!legacyId) throw new Error('最终作品兼容记录创建失败')
      await supabase.from('completion_moderation_logs').upsert(
        { completion_id: legacyId, status: 'queued' } as never,
        { onConflict: 'completion_id' },
      )
      const moderationCaseId = moderation.state === 'pending'
        ? await createModerationCase({
            contentType: 'completion',
            contentId: legacyId,
            authorId: user.id,
            riskLevel: moderation.riskLevel,
            category: moderation.category,
            reason: moderation.reason,
            modelName: moderation.modelName,
            snapshot: { authorId: user.id, text: payload.notes || null, metadata: { imageUrls: payload.images } },
          })
        : null
      if (!moderationCaseId) scheduleCompletionModeration(legacyId)
      return NextResponse.json(
        moderationCaseId
          ? { id: legacyId, recordId: record.id, status: 'pending', recordKind: 'final', journeyId: journey.id, moderation: { state: 'pending', caseId: moderationCaseId } }
          : { id: legacyId, recordId: record.id, status: 'pending', recordKind: 'final', journeyId: journey.id },
        { status: moderationCaseId ? 202 : 201 },
      )
    }
    if (!legacyId) throw new Error('公开探索记录兼容记录创建失败')
    await supabase.from('completion_moderation_logs').upsert(
      { completion_id: legacyId, status: 'queued' } as never,
      { onConflict: 'completion_id' },
    )
    const moderationCaseId = moderation.state === 'pending'
      ? await createModerationCase({
          contentType: 'completion',
          contentId: legacyId,
          authorId: user.id,
          riskLevel: moderation.riskLevel,
          category: moderation.category,
          reason: moderation.reason,
          modelName: moderation.modelName,
          snapshot: { authorId: user.id, text: payload.notes || null, metadata: { imageUrls: payload.images } },
        })
      : null

    if (!moderationCaseId) scheduleCompletionModeration(legacyId)

    return NextResponse.json(
      moderationCaseId
        ? { id: legacyId, recordId: record.id, status: 'pending', recordKind: 'progress', journeyId: journey.id, moderation: { state: 'pending', caseId: moderationCaseId } }
        : { id: legacyId, recordId: record.id, status: 'pending', recordKind: 'progress', journeyId: journey.id },
      { status: moderationCaseId ? 202 : 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import {
  isOwnedCompletionVideoUrl,
  isOwnedProjectImageUrl,
  validateContentSafeIfPresent,
  validateNumber,
} from '@/lib/api/validation'
import { canResubmitCompletion } from '@/lib/completion-records'
import { scheduleCompletionModeration } from '@/lib/completions/moderate-completion'
import { getProjectCompletions } from '@/lib/api/explore-data'
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

const SubmitCompletionSchema = z.object({
  kind: z.enum(['progress', 'final']),
  recordType: z.string().max(32).optional(),
  stageLabel: z.string().max(64).optional(),
  images: z.array(z.string().url()).min(1).max(9),
  imageCaptions: z.array(z.string().max(200)).optional(),
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(5000).optional(),
  isPublic: z.boolean().optional(),
})

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
    await requireInteractionAccess(supabase, user, 'submit')
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
      text: [payload.notes, ...(payload.imageCaptions || [])]
        .filter((value): value is string => Boolean(value?.trim()))
        .join('\n'),
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

    const { data: exploration, error: explorationError } = await supabase
      .from('project_explorations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (explorationError) throw explorationError

    let explorationId = (exploration as { id?: number } | null)?.id ?? null
    const explorationStatus = (exploration as { status?: string } | null)?.status

    if (!explorationId || explorationStatus !== 'active') {
      const now = new Date().toISOString()
      const { data: upserted, error: startError } = await supabase
        .from('project_explorations')
        .upsert(
          {
            user_id: user.id,
            project_id: projectId,
            status: 'active',
            started_at: now,
            last_activity_at: now,
            updated_at: now,
          } as never,
          { onConflict: 'user_id,project_id' },
        )
        .select('id')
        .single()

      if (startError) throw startError
      explorationId = (upserted as { id: number }).id
    }

    if (recordKind === 'progress' && explorationStatus === 'completed') {
      return NextResponse.json({ error: '已提交最终作品，无法再发布过程记录' }, { status: 400 })
    }

    if (recordKind === 'final') {
      const { data: existingFinal, error: finalError } = await supabase
        .from('completed_projects')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .eq('record_kind', 'final')
        .maybeSingle()

      if (finalError) throw finalError

      const current = existingFinal as { id: number; status?: string | null } | null
      if (current && !canResubmitCompletion(current.status)) {
        return NextResponse.json({ error: '你已经提交过该项目的最终作品' }, { status: 400 })
      }

      const insertData = {
        proof_images: payload.images,
        proof_captions: payload.imageCaptions?.length ? payload.imageCaptions : null,
        proof_video_url: payload.videoUrl || null,
        notes: payload.notes || null,
        is_public: payload.isPublic ?? true,
        status: 'pending',
        record_kind: 'final',
        record_type: payload.recordType || null,
        stage_label: payload.stageLabel || null,
        exploration_id: explorationId,
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        moderation_source: 'ai',
        moderation_state: moderation.state,
      }

      let completionId: number
      if (current && canResubmitCompletion(current.status)) {
        const { data: updated, error: updateError } = await supabase
          .from('completed_projects')
          .update(insertData as never)
          .eq('id', current.id)
          .select('id, status')
          .single()
        if (updateError) throw updateError
        completionId = (updated as { id: number }).id
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('completed_projects')
          .insert({
            ...insertData,
            user_id: user.id,
            project_id: projectId,
          } as never)
          .select('id, status')
          .single()
        if (insertError) throw insertError
        completionId = (inserted as { id: number }).id
      }

      await supabase.from('completion_moderation_logs').upsert(
        { completion_id: completionId, status: 'queued' } as never,
        { onConflict: 'completion_id' },
      )

      const moderationCaseId = moderation.state === 'pending'
        ? await createModerationCase({
            contentType: 'completion',
            contentId: completionId,
            authorId: user.id,
            riskLevel: moderation.riskLevel,
            category: moderation.category,
            reason: moderation.reason,
            modelName: moderation.modelName,
            snapshot: { authorId: user.id, text: payload.notes || null, metadata: { imageUrls: payload.images } },
          })
        : null

      if (!moderationCaseId) scheduleCompletionModeration(completionId)

      return NextResponse.json(
        moderationCaseId
          ? { id: completionId, status: 'pending', recordKind: 'final', moderation: { state: 'pending', caseId: moderationCaseId } }
          : { id: completionId, status: 'pending', recordKind: 'final' },
        { status: moderationCaseId ? 202 : 201 },
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from('completed_projects')
      .insert({
        user_id: user.id,
        project_id: projectId,
        proof_images: payload.images,
        proof_captions: payload.imageCaptions?.length ? payload.imageCaptions : null,
        proof_video_url: payload.videoUrl || null,
        notes: payload.notes || null,
        is_public: payload.isPublic ?? true,
        status: 'pending',
        record_kind: 'progress',
        record_type: payload.recordType || null,
        stage_label: payload.stageLabel || null,
        exploration_id: explorationId,
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        moderation_source: 'ai',
        moderation_state: moderation.state,
      } as never)
      .select('id, status')
      .single()

    if (insertError) throw insertError

    const completionId = (inserted as { id: number }).id

    await supabase
      .from('project_explorations')
      .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq('id', explorationId)

    await supabase.from('completion_moderation_logs').upsert(
      { completion_id: completionId, status: 'queued' } as never,
      { onConflict: 'completion_id' },
    )

    const moderationCaseId = moderation.state === 'pending'
      ? await createModerationCase({
          contentType: 'completion',
          contentId: completionId,
          authorId: user.id,
          riskLevel: moderation.riskLevel,
          category: moderation.category,
          reason: moderation.reason,
          modelName: moderation.modelName,
          snapshot: { authorId: user.id, text: payload.notes || null, metadata: { imageUrls: payload.images } },
        })
      : null

    if (!moderationCaseId) scheduleCompletionModeration(completionId)

    return NextResponse.json(
      moderationCaseId
        ? { id: completionId, status: 'pending', recordKind: 'progress', moderation: { state: 'pending', caseId: moderationCaseId } }
        : { id: completionId, status: 'pending', recordKind: 'progress' },
      { status: moderationCaseId ? 202 : 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}

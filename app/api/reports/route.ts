import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateEnum, validateNumber, validateOptionalString } from '@/lib/api/validation'
import {
  createModerationCase,
  getContentSnapshot,
  moderateTextContent,
  setContentModerationState,
} from '@/lib/safety/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const CONTENT_TYPES = ['project', 'discussion', 'discussion_reply', 'comment', 'message', 'completion_comment', 'observation'] as const
const REASONS = ['spam', 'harassment', 'inappropriate', 'illegal', 'other'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-reports', limit: 10, windowMs: 60_000 })

    const body = await request.json()

    const content_type = validateEnum(body?.content_type, 'content_type', CONTENT_TYPES)
    const content_id = validateNumber(body?.content_id, 'content_id', { integer: true, min: 1 })
    const reason = validateEnum(body?.reason, 'reason', REASONS)
    const description = validateOptionalString(body?.description, 'description', 500)
    const snapshot = await getContentSnapshot(supabase, content_type, content_id)

    if (!snapshot) {
      return NextResponse.json({ error: '举报内容不存在或当前不可访问' }, { status: 404 })
    }

    const moderation = snapshot.text
      ? moderateTextContent(snapshot.text, content_type === 'message' ? 'message' : 'public')
      : { state: 'approved' as const, riskLevel: 'low' as const, category: null, reason: null, modelName: 'no-text-v1' }
    const riskLevel = reason === 'illegal' || moderation.riskLevel === 'high' ? 'high' : moderation.riskLevel
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        content_type,
        content_id,
        reason,
        description: description || null,
        author_id: snapshot.authorId,
        risk_level: riskLevel,
        snapshot_text: snapshot.text,
        snapshot_metadata: snapshot.metadata,
        evidence_expires_at: expiresAt,
      } as never)
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '您已经举报过该内容' }, { status: 409 })
      }
      throw error
    }

    let autoAction: 'hidden' | null = null
    let caseId: number | null = null

    if (supabaseAdmin) {
      const { data: recentReports, error: recentReportsError } = await supabaseAdmin
        .from('reports')
        .select('reporter_id')
        .eq('content_type', content_type)
        .eq('content_id', content_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (recentReportsError) throw recentReportsError
      const uniqueReporters = new Set((recentReports ?? []).map((report) => report.reporter_id))
      const shouldHide = riskLevel === 'high' || uniqueReporters.size >= 3
      autoAction = shouldHide ? 'hidden' : null

      try {
        caseId = await createModerationCase({
          contentType: content_type,
          contentId: content_id,
          authorId: snapshot.authorId,
          source: 'report',
          status: shouldHide ? 'hidden' : 'pending',
          riskLevel,
          category: moderation.category,
          reason: description || moderation.reason || `用户举报：${reason}`,
          modelName: moderation.modelName,
          snapshot,
        })
      } catch (caseError) {
        // A duplicate active case should not make a valid report fail.
        if (!(caseError instanceof Error && caseError.message.includes('idx_moderation_cases_one_active'))) {
          throw caseError
        }
      }

      if (shouldHide) {
        await setContentModerationState(content_type, content_id, 'hidden')
      }

      const { error: reportUpdateError } = await supabaseAdmin
        .from('reports')
        .update({ moderation_case_id: caseId, auto_action: autoAction } as never)
        .eq('id', data.id)
      if (reportUpdateError) throw reportUpdateError
    }

    return NextResponse.json({ report: { ...data, autoAction } }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

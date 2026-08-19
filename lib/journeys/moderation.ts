import type { SupabaseClient } from '@supabase/supabase-js'

import { createModerationCase } from '@/lib/safety/server'
import { scheduleCompletionModeration } from '@/lib/completions/moderate-completion'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import {
  syncLegacyChallengeFinal,
  syncLegacyProjectRecord,
} from './service'
import type { Journey, JourneyRecord } from './types'

type JourneyClient = SupabaseClient<Database>

/**
 * Route every public Journey record into the review system that already owns
 * that kind of content. Private drafts deliberately never enter a queue.
 */
export async function queueJourneyRecordModeration(
  client: JourneyClient,
  journey: Journey,
  record: JourneyRecord,
) {
  if (record.visibility !== 'public') return

  if (journey.source_type === 'project') {
    const legacyId = await syncLegacyProjectRecord(client, journey, record)
    if (!legacyId) return

    const { error } = await client
      .from('completion_moderation_logs')
      .upsert(
        { completion_id: legacyId, status: 'queued', updated_at: new Date().toISOString() } as never,
        { onConflict: 'completion_id' },
      )
    if (error) throw error
    scheduleCompletionModeration(legacyId)
    return
  }

  if (record.record_kind === 'final') {
    const legacyId = await syncLegacyChallengeFinal(client, journey, record)
    if (legacyId && supabaseAdmin) {
      await createModerationCase({
        contentType: 'challenge_submission',
        contentId: legacyId,
        authorId: journey.user_id,
        riskLevel: 'medium',
        category: 'challenge_submission_review',
        reason: '挑战最终作品需要人工确认。',
        modelName: record.moderation_source,
        snapshot: {
          authorId: journey.user_id,
          text: [record.title, record.notes].filter(Boolean).join('\n'),
          metadata: { imageUrls: record.images },
        },
      })
    } else if (supabaseAdmin) {
      // There is only one legacy challenge row per user/challenge. Historical
      // attempts therefore use the Journey record directly as the moderation
      // target and cannot be represented by challenge_submissions.
      await createModerationCase({
        contentType: 'journey_record',
        contentId: record.id,
        authorId: journey.user_id,
        riskLevel: record.moderation_state === 'pending' ? 'medium' : 'low',
        category: record.moderation_state === 'pending' ? 'moderation_pending' : 'challenge_submission_review',
        reason: record.moderation_state === 'pending' ? '历史挑战最终作品需要人工确认。' : '历史挑战最终作品等待公开审核。',
        modelName: record.moderation_source,
        snapshot: {
          authorId: journey.user_id,
          text: [record.title, record.notes].filter(Boolean).join('\n'),
          metadata: { imageUrls: record.images },
        },
      })
    }
    return
  }

  if (!supabaseAdmin) return
  await createModerationCase({
    contentType: 'journey_record',
    contentId: record.id,
    authorId: journey.user_id,
    riskLevel: record.moderation_state === 'pending' ? 'medium' : 'low',
    category: record.moderation_state === 'pending' ? 'moderation_pending' : 'journey_record',
    reason: record.moderation_state === 'pending' ? 'PBL 阶段记录需要人工确认。' : 'PBL 阶段记录等待公开审核。',
    modelName: record.moderation_source,
    snapshot: {
      authorId: journey.user_id,
      text: [record.title, record.notes].filter(Boolean).join('\n'),
      metadata: { imageUrls: record.images, anchorIndex: record.anchor_index },
    },
  })
}

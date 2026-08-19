import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  isOwnedCompletionVideoUrl,
  validateContentSafeIfPresent,
  validateNumber,
  validateOwnedOrTrustedProjectImageUrl,
} from '@/lib/api/validation'
import {
  completeJourneyForApprovedFinal,
  getJourneyById,
  listJourneyRecords,
  syncLegacyChallengeFinal,
  syncLegacyChallengeStage,
  syncLegacyProjectRecord,
  touchJourney,
  upsertJourneyRecord,
} from '@/lib/journeys/service'
import { queueJourneyRecordModeration } from '@/lib/journeys/moderation'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const UrlSchema = z.union([z.string().url(), z.string().min(1).startsWith('/')])
const JourneyRecordSchema = z.object({
  record_id: z.number().int().positive().optional(),
  record_kind: z.enum(['progress', 'final']).default('progress'),
  anchor_type: z.enum(['step', 'stage', 'extra', 'final']).optional(),
  anchor_index: z.number().int().min(0).max(100).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  images: z.array(UrlSchema).max(9).default([]),
  image_captions: z.array(z.string().max(200)).max(9).nullable().optional(),
  video_url: UrlSchema.nullable().optional(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
})

function getId(value: string) {
  return validateNumber(value, 'Journey id', { min: 1, integer: true })
}

async function validateMedia(
  images: string[],
  videoUrl: string | null | undefined,
  userId: string,
) {
  for (const image of images) {
    validateOwnedOrTrustedProjectImageUrl(image, userId, '记录图片', {
      bucket: 'project-completions',
      pathPrefix: 'challenge-submissions',
    })
  }
  if (videoUrl && !isOwnedCompletionVideoUrl(videoUrl, userId)) {
    throw new Error('记录视频必须使用当前账号上传的文件')
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const journeyId = getId((await params).id)
    const journey = await getJourneyById(supabase, journeyId, user.id)
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 })
    const records = await listJourneyRecords(supabase, journeyId, {
      limit: Number(request.nextUrl.searchParams.get('limit')) || 100,
      before: request.nextUrl.searchParams.get('before') || undefined,
    })
    return NextResponse.json({ records })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const journeyId = getId((await params).id)
    const body = await request.json().catch(() => ({}))
    const parsed = JourneyRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 })
    }

    const journey = await getJourneyById(supabase, journeyId, user.id)
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 })

    const visibility = parsed.data.visibility ?? (parsed.data.record_kind === 'final' ? 'public' : 'private')
    await requireInteractionAccess(supabase, user, visibility === 'public' || parsed.data.record_kind === 'final' ? 'submit' : 'save_progress')
    await requireRateLimit(supabase, { key: 'api-journey-records-write', limit: 30, windowMs: 60_000 })
    await validateMedia(parsed.data.images, parsed.data.video_url, user.id)
    validateContentSafeIfPresent(parsed.data.title, '记录标题')
    validateContentSafeIfPresent(parsed.data.notes, '记录说明')
    for (const caption of parsed.data.image_captions ?? []) validateContentSafeIfPresent(caption, '图片说明')

    let moderationState = 'approved'
    let moderationSource = 'private_draft'
    if (visibility === 'public') {
      const { moderateUserContent } = await import('@/lib/safety/server')
      const moderation = await moderateUserContent({
        text: [parsed.data.title, parsed.data.notes, ...(parsed.data.image_captions || [])]
          .filter((value): value is string => Boolean(value?.trim()))
          .join('\n'),
        imageSources: parsed.data.images,
      })
      if (moderation.state === 'rejected') {
        return NextResponse.json({ error: moderation.reason || '记录未通过安全检查', code: 'CONTENT_REJECTED' }, { status: 422 })
      }
      moderationState = moderation.state
      moderationSource = moderation.modelName || 'ai'
    }

    const record = await upsertJourneyRecord(supabase, journeyId, user.id, {
      recordId: parsed.data.record_id,
      recordKind: parsed.data.record_kind,
      anchorType: parsed.data.anchor_type,
      anchorIndex: parsed.data.anchor_index,
      title: parsed.data.title,
      notes: parsed.data.notes,
      images: parsed.data.images,
      imageCaptions: parsed.data.image_captions,
      videoUrl: parsed.data.video_url,
      data: parsed.data.data as Json | null | undefined,
      visibility,
      moderationState,
      moderationSource,
    })

    if (record.record_kind === 'final') {
      if (journey.source_type === 'project') {
        await syncLegacyProjectRecord(supabase, journey, record)
      } else {
        await syncLegacyChallengeFinal(supabase, journey, record)
      }
      if (record.status === 'approved' && record.moderation_state === 'approved') {
        await completeJourneyForApprovedFinal(supabase, journeyId, user.id, record.id)
      }
    } else if (journey.source_type === 'project') {
      await syncLegacyProjectRecord(supabase, journey, record)
    } else {
      await syncLegacyChallengeStage(supabase, journey, record)
    }

    await queueJourneyRecordModeration(supabase, journey, record)

    await touchJourney(supabase, journeyId, user.id)
    return NextResponse.json({ record }, { status: moderationState === 'pending' ? 202 : 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

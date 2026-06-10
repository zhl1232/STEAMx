import { NextRequest, NextResponse } from 'next/server'

import {
  chatWithTutor,
  getStageCoachUserMessage,
  type StageCoachContext,
  type TutorChatMessage,
} from '@/lib/ai/pbl-stage-coach'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { getStageProgressByUser } from '@/lib/api/challenge-stage-progress'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  ValidationError,
  validateContentSafeIfPresent,
  validateOwnedOrTrustedProjectImageUrl,
} from '@/lib/api/validation'
import type { ChallengeStage } from '@/lib/mappers/types'
import { ChallengeTutorSendSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

const STAGE_IMAGE_OPTIONS = { bucket: 'project-completions', pathPrefix: 'challenge-submissions' } as const
const HISTORY_LIMIT = 200
const CONTEXT_TURNS = 12

type TutorMessageRow = Database['public']['Tables']['challenge_tutor_messages']['Row']

function mapMessage(row: TutorMessageRow) {
  return {
    role: row.role as 'user' | 'assistant',
    content: row.content,
    images: row.images ?? undefined,
    stageIndex: row.stage_index ?? undefined,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ messages: [] })
    }

    const { data, error } = await supabase
      .from('challenge_tutor_messages')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .order('id', { ascending: true })
      .limit(HISTORY_LIMIT)

    if (error) throw error
    return NextResponse.json({ messages: ((data ?? []) as TutorMessageRow[]).map(mapMessage) })
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
    await requireRateLimit(supabase, { key: 'api-challenge-tutor-chat', limit: 20, windowMs: 60_000 })

    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = ChallengeTutorSendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const content = parsed.data.content.trim()
    const images = parsed.data.images

    validateContentSafeIfPresent(content, '对话内容')
    for (const image of images) {
      validateOwnedOrTrustedProjectImageUrl(image, user.id, '产出图片', STAGE_IMAGE_OPTIONS)
    }

    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('title, driving_question, constraints, stages')
      .eq('id', challengeId)
      .maybeSingle()

    if (error) throw error
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const stages = (Array.isArray((challenge as { stages?: unknown }).stages)
      ? (challenge as { stages: unknown[] }).stages
      : []) as ChallengeStage[]
    if (stages.length === 0) {
      return NextResponse.json({ error: '该挑战没有阶段' }, { status: 400 })
    }

    const stageIndex = Math.min(Math.max(parsed.data.stageIndex, 0), stages.length - 1)
    const stage = stages[stageIndex]

    // Load the student's saved per-stage outputs so the tutor has project memory.
    const STATUS_LABEL: Record<string, string> = {
      not_started: '未开始',
      in_progress: '进行中',
      completed: '已完成',
    }
    const progressList = await getStageProgressByUser(supabase, challengeId, user.id)
    const progressByIndex = new Map(progressList.map((item) => [item.stageIndex, item]))
    const progressSummary = stages
      .map((s, i) => {
        const p = progressByIndex.get(i)
        const status = STATUS_LABEL[p?.status ?? 'not_started'] ?? '未开始'
        const parts: string[] = []
        if (p?.notes?.trim()) parts.push(p.notes.trim())
        if (typeof p?.data?.summary === 'string' && p.data.summary.trim()) parts.push(`数据：${p.data.summary.trim()}`)
        if (p?.images?.length) parts.push(`（${p.images.length} 张图片）`)
        const checklist = s.checklist ?? []
        if (checklist.length > 0) {
          const checked = Array.isArray(p?.data?.checked) ? (p?.data?.checked as number[]) : []
          const pending = checklist.filter((_, idx) => !checked.includes(idx))
          parts.push(`清单 ${checked.length}/${checklist.length}${pending.length ? `（待办：${pending.join('、')}）` : '（已全部完成）'}`)
        }
        const body = parts.length > 0 ? parts.join(' ') : '（暂无记录）'
        const marker = i === stageIndex ? '👉 ' : ''
        return `${marker}第${i + 1}步「${s.title}」[${status}]：${body}`
      })
      .join('\n')

    // Load recent history (server is source of truth) for conversation context.
    const { data: recentRows, error: historyError } = await supabase
      .from('challenge_tutor_messages')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .order('id', { ascending: false })
      .limit(CONTEXT_TURNS)

    if (historyError) throw historyError

    const history: TutorChatMessage[] = ((recentRows ?? []) as TutorMessageRow[])
      .slice()
      .reverse()
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
        images: row.images ?? undefined,
      }))

    history.push({ role: 'user', content: content || '请看看我这一步的产出。', images: images.length ? images : undefined })

    const context: StageCoachContext = {
      challengeTitle: (challenge as { title: string }).title,
      drivingQuestion: (challenge as { driving_question: string | null }).driving_question,
      constraints: (challenge as { constraints: string[] | null }).constraints,
      stageTitle: stage.title,
      stageDescription: stage.description,
      stageHint: stage.hint ?? null,
      stageKind: stage.kind ?? null,
      currentStageIndex: stageIndex,
      totalStages: stages.length,
      progressSummary,
    }

    const reply = await chatWithTutor(context, history)

    // Persist user + assistant turns (only after a successful reply).
    const { error: insertError } = await supabase
      .from('challenge_tutor_messages')
      .insert([
        {
          challenge_id: challengeId,
          user_id: user.id,
          role: 'user',
          content: content || '请看看我这一步的产出。',
          images: images.length ? images : null,
          stage_index: stageIndex,
        },
        {
          challenge_id: challengeId,
          user_id: user.id,
          role: 'assistant',
          content: reply,
          images: null,
          stage_index: stageIndex,
        },
      ] as never)

    if (insertError) throw insertError

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.name === 'StageCoachError') {
      return NextResponse.json({ error: getStageCoachUserMessage(error) }, { status: 502 })
    }
    return handleApiError(error)
  }
}

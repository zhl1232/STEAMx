import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getLessonInCourse } from '@/lib/api/courses'
import { canResubmitCompletion } from '@/lib/completion-records'
import { scheduleCompletionModeration } from '@/lib/completions/moderate-completion'
import { createClient } from '@/lib/supabase/server'
import { isWorkSubmissionEnabled } from '@/lib/works/capability'
import { getLessonWorks } from '@/lib/works/data'
import { validateWorkSubmission, WorkSubmissionSchema } from '@/lib/works/submission'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

function parseIds(courseIdRaw: string, lessonIdRaw: string) {
  const courseId = Number(courseIdRaw)
  const lessonId = Number(lessonIdRaw)
  if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(lessonId) || lessonId <= 0) {
    return null
  }
  return { courseId, lessonId }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const raw = await params
    const ids = parseIds(raw.courseId, raw.lessonId)
    if (!ids) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const supabase = await createClient()
    const context = await getLessonInCourse(supabase, ids.courseId, ids.lessonId)
    if (!context || context.course.status !== 'approved') {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    return NextResponse.json({ works: await getLessonWorks(ids.lessonId) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-course-works-submit', limit: 8, windowMs: 60_000 })

    const raw = await params
    const ids = parseIds(raw.courseId, raw.lessonId)
    if (!ids) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const context = await getLessonInCourse(supabase, ids.courseId, ids.lessonId)
    if (!context || context.course.status !== 'approved') {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }
    if (!isWorkSubmissionEnabled(context.lesson)) {
      return NextResponse.json({ error: '这节课未开放作品发布' }, { status: 403 })
    }

    const parsed = WorkSubmissionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }
    validateWorkSubmission(parsed.data, user.id)

    const { data: existing, error: existingError } = await supabase
      .from('completed_projects')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('course_lesson_id', ids.lessonId)
      .eq('record_kind', 'final')
      .maybeSingle()
    if (existingError) throw existingError

    const current = existing as { id: number; status?: string | null } | null
    if (current && !canResubmitCompletion(current.status)) {
      return NextResponse.json({ error: '你已经提交过这节课的作品' }, { status: 400 })
    }

    const workData = {
      project_id: null,
      course_lesson_id: ids.lessonId,
      proof_images: parsed.data.images,
      proof_captions: parsed.data.imageCaptions?.length ? parsed.data.imageCaptions : null,
      proof_video_url: parsed.data.videoUrl || null,
      notes: parsed.data.notes || null,
      is_public: parsed.data.isPublic ?? true,
      status: 'pending',
      record_kind: 'final',
      record_type: 'course_work',
      stage_label: null,
      exploration_id: null,
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      moderation_source: 'ai',
    }

    const result = current
      ? await supabase
          .from('completed_projects')
          .update(workData as never)
          .eq('id', current.id)
          .select('id')
          .single()
      : await supabase
          .from('completed_projects')
          .insert({ ...workData, user_id: user.id } as never)
          .select('id')
          .single()
    if (result.error) throw result.error

    const workId = Number((result.data as { id: number }).id)
    await supabase.from('completion_moderation_logs').upsert(
      { completion_id: workId, status: 'queued' } as never,
      { onConflict: 'completion_id' },
    )
    scheduleCompletionModeration(workId)

    return NextResponse.json({ id: workId, status: 'pending', recordKind: 'final' }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

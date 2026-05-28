import { NextRequest, NextResponse } from 'next/server'

import {
  buildScratchProjectStoragePath,
  getLessonInCourse,
  getUserLessonProgress,
  upsertUserLessonProgress,
} from '@/lib/api/courses'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { detectSb3FromBytes } from '@/lib/utils/file-validation'
import { logger } from '@/lib/logger'

const SIGNED_URL_TTL_SEC = 3600
const MAX_SB3_BYTES = 10 * 1024 * 1024

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { courseId: courseIdRaw, lessonId: lessonIdRaw } = await params
  const courseId = Number(courseIdRaw)
  const lessonId = Number(lessonIdRaw)

  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const user = await requireAuth(supabase)
    const ctx = await getLessonInCourse(supabase, courseId, lessonId)
    if (!ctx) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const progress = await getUserLessonProgress(supabase, user.id, lessonId)
    const storagePath =
      progress?.scratch_project_path ??
      ctx.lesson.starter_project_path ??
      null

    if (!storagePath || !supabaseAdmin) {
      return NextResponse.json({
        projectUrl: null,
        storagePath: null,
        hasUserProject: Boolean(progress?.scratch_project_path),
      })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('scratch-projects')
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC)

    if (error) throw error

    return NextResponse.json({
      projectUrl: data.signedUrl,
      storagePath,
      hasUserProject: Boolean(progress?.scratch_project_path),
    })
  } catch (error) {
    logger.error('GET lesson project failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { courseId: courseIdRaw, lessonId: lessonIdRaw } = await params
  const courseId = Number(courseIdRaw)
  const lessonId = Number(lessonIdRaw)

  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'api-courses-save-project',
      limit: 20,
      windowMs: 60_000,
    })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
    }

    const ctx = await getLessonInCourse(supabase, courseId, lessonId)
    if (!ctx) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请上传 .sb3 项目文件' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    if (buffer.byteLength > MAX_SB3_BYTES) {
      return NextResponse.json({ error: '项目文件不能超过 10MB' }, { status: 400 })
    }
    if (!detectSb3FromBytes(buffer)) {
      return NextResponse.json({ error: '无效的项目文件格式' }, { status: 400 })
    }

    const storagePath = buildScratchProjectStoragePath(user.id, courseId, lessonId)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('scratch-projects')
      .upload(storagePath, Buffer.from(buffer), {
        contentType: 'application/x.scratch.sb3',
        upsert: true,
      })

    if (uploadError) throw uploadError

    const progress = await upsertUserLessonProgress(supabase, {
      userId: user.id,
      lessonId,
      scratchProjectPath: storagePath,
    })

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('scratch-projects')
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC)

    if (signError) throw signError

    return NextResponse.json({
      storagePath,
      projectUrl: signed.signedUrl,
      progress,
    })
  } catch (error) {
    logger.error('POST lesson project failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}

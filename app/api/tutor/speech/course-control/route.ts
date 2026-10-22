import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/api/auth'
import { getLessonInCourse } from '@/lib/api/courses'
import { buildBuildingLessonFlow } from '@/lib/courses/building-lesson-flow'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store' }

/** Renewable eligibility only: no audio, ASR, billing or recognition quota. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const ids = ['courseId', 'lessonId'].map((key) => request.nextUrl.searchParams.get(key))
    if (ids.some((id) => !id || !/^[1-9]\d{0,14}$/u.test(id))) {
      return NextResponse.json({ error: '课程信息不正确，请重新开启。' }, { status: 400, headers })
    }
    const [courseId, lessonId] = ids.map(Number)
    // Keep the existing approved/classification/lesson-ownership gates, including
    // approved historical courses accessible by direct link while unlisted.
    const context = await getLessonInCourse(supabase, courseId, lessonId)
    if (!context) return NextResponse.json({ error: '暂时无法打开这节课。' }, { status: 404, headers })
    if (context.lesson.lesson_type !== 'building_3d' ||
      buildBuildingLessonFlow({ lessonTitle: context.lesson.title, content: context.lesson.content?.building3d }).length === 0) {
      return NextResponse.json({ error: '这节课暂不支持语音翻页。' }, { status: 400, headers })
    }
    return NextResponse.json({ userId: user.id, validForMs: 300_000 }, { headers })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: '请登录后开启语音操作。' }, { status: error.statusCode, headers })
    return NextResponse.json({ error: '暂时无法确认课程访问权限，请稍后重试。' }, { status: 503, headers })
  }
}

/** Old tabs fail visibly. Never silently send course-control recordings to cloud ASR. */
export async function POST() {
  return NextResponse.json({ error: '语音搭建已改为设备内识别，请刷新页面后开启。' }, { status: 410, headers })
}

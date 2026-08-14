import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { getAccessibleProject } from '@/lib/api/project-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import { assertUsersNotBlocked } from '@/lib/safety/server'

const ALLOWED_TYPES = new Set(['project', 'completion'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'engage')
    await requireRateLimit(supabase, { key: 'api-tips', limit: 10, windowMs: 60_000 })
    const body = await request.json()

    const resourceType = typeof body?.resourceType === 'string' ? body.resourceType : ''
    const resourceId = Number(body?.resourceId)
    const amount = Number(body?.amount)

    if (!ALLOWED_TYPES.has(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    if (Number.isNaN(amount) || !Number.isInteger(amount) || amount <= 0 || amount > 2) {
      return NextResponse.json({ error: 'Invalid amount (1–2)' }, { status: 400 })
    }

    let recipientUserId: string | null = null
    let projectId: number | null = null
    let projectTitle = '项目'

    if (resourceType === 'project') {
      const project = await getAccessibleProject(supabase, resourceId, user.id)
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 })
      }
      recipientUserId = project.author_id
      projectId = project.id
      projectTitle = project.title || projectTitle
    } else {
      const completion = await getAccessibleCompletion(supabase, resourceId, user.id)
      if (!completion) {
        return NextResponse.json({ error: '作品不存在' }, { status: 404 })
      }
      recipientUserId = completion.user_id
      projectId = completion.project_id

      if (completion.project_id) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('title')
          .eq('id', completion.project_id)
          .maybeSingle()
        if (projectError) throw projectError
        projectTitle = (project as { title?: string | null } | null)?.title || projectTitle
      } else if (completion.course_lesson_id) {
        const { data: lesson, error: lessonError } = await supabase
          .from('course_lessons')
          .select('title')
          .eq('id', completion.course_lesson_id)
          .maybeSingle()
        if (lessonError) throw lessonError
        projectTitle = (lesson as { title?: string | null } | null)?.title || '课程作品'
      }
    }

    // 打赏会往对方通知里塞一条带昵称头像的记录，屏蔽后必须和点赞/评论一样走不通。
    if (recipientUserId) {
      await assertUsersNotBlocked(supabase, user.id, recipientUserId)
    }

    const { data, error } = await supabase.rpc('tip_resource', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_amount: amount,
    } as never)

    if (error) throw error

    const result = data as { ok?: boolean; error?: string } | null
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error || 'tip_failed' }, { status: 422 })
    }

    if (recipientUserId && recipientUserId !== user.id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      const typedProfile = profile as { display_name?: string | null; avatar_url?: string | null } | null
      const actorName = typedProfile?.display_name || user.email?.split('@')[0] || '用户'
      const actorAvatar = typedProfile?.avatar_url || getDefaultAvatarPath(user.id)

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientUserId,
          type: 'tip',
          content: `${actorName} 给你的《${projectTitle}》投了 ${amount} 枚币`,
          related_type: resourceType,
          related_id: resourceId,
          project_id: projectId,
          from_user_id: user.id,
          from_username: actorName,
          from_avatar: actorAvatar,
        } as never)

      if (notificationError) throw notificationError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

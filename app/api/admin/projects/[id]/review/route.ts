import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateNumber, validateOptionalString } from '@/lib/api/validation'
import { callRpc } from '@/lib/supabase/rpc'
import { logger } from '@/lib/logger'

async function sendCreatorUpdateNotifications(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  authorId: string
  projectId: number
  projectTitle: string
}) {
  const { supabase, authorId, projectId, projectTitle } = params

  const { data: followRows, error: followsError } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', authorId)

  if (followsError) throw followsError
  if (!followRows?.length) return

  const followerIds = (followRows as { follower_id: string }[]).map((row) => row.follower_id)

  const [{ data: authorProfile, error: authorError }, { data: prefs, error: prefsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', authorId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id')
      .in('id', followerIds)
      .or('notify_followed_creator_updates.eq.true,notify_followed_creator_updates.is.null'),
  ])

  if (authorError) throw authorError
  if (prefsError) throw prefsError

  const recipientIds = Array.from(new Set(((prefs || []) as { id: string }[]).map((row) => row.id)))
  if (recipientIds.length === 0) return

  const authorName = (authorProfile as { display_name?: string | null } | null)?.display_name || '某用户'
  const authorAvatar = (authorProfile as { avatar_url?: string | null } | null)?.avatar_url || null

  const notifications = recipientIds.map((userId) => ({
    user_id: userId,
    type: 'creator_update',
    content: `${authorName} 发布了新作品：${projectTitle}`,
    related_type: 'project',
    related_id: projectId,
    project_id: projectId,
    discussion_id: null,
    from_user_id: authorId,
    from_username: authorName,
    from_avatar: authorAvatar,
  }))

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notifications as never)

  if (insertError) throw insertError
}

/**
 * POST /api/admin/projects/[id]/review
 * 审核项目（批准或拒绝）
 * 需要审核员或管理员权限
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    // 检查用户权限
    await requireRole(supabase, ['moderator', 'admin'])
    
    const body = await request.json()
    
    // 验证输入
    const action = validateEnum(body.action, 'Action', ['approve', 'reject'] as const)
    const rejection_reason = validateOptionalString(body.rejection_reason, 'Rejection reason', 500)
    
    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a project' },
        { status: 400 }
      )
    }
    
    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })
    const { data: existingProject, error: projectLookupError } = await supabase
      .from('projects')
      .select('id, author_id, challenge_id, title, status')
      .eq('id', projectId)
      .maybeSingle()

    if (projectLookupError) {
      throw projectLookupError
    }

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = existingProject as {
      id: number
      author_id: string
      challenge_id: number | null
      title: string
      status: string | null
    }
    const wasApproved = project.status === 'approved'
    
    if (action === 'approve') {
      const { error } = await callRpc(supabase, 'approve_project', {
        project_id: projectId
      })
      
      if (error) {
        throw error
      }

      // Trigger evergreen challenge completion if applicable
      if (project.challenge_id) {
          const { data: ch } = await supabase
            .from('challenges')
            .select('challenge_type, status')
            .eq('id', project.challenge_id)
            .single()

          if (ch && (ch as { challenge_type: string; status: string }).challenge_type === 'evergreen'
            && (ch as { challenge_type: string; status: string }).status === 'active') {
            const { error: rpcError } = await (supabase.rpc as unknown as (
              fn: string, args: unknown
            ) => PromiseLike<{ data: unknown; error: unknown }>)(
              'complete_evergreen_challenge',
              { p_user_id: project.author_id, p_challenge_id: project.challenge_id, p_project_id: projectId }
            )
            if (rpcError) throw rpcError
          }
      }

      if (!wasApproved) {
        try {
          await sendCreatorUpdateNotifications({
            supabase,
            authorId: project.author_id,
            projectId,
            projectTitle: project.title,
          })
        } catch (notificationError) {
          logger.error(notificationError, { context: 'Project approval follower notification failed', projectId })
      }
      }
      
      return NextResponse.json({ 
        message: 'Project approved successfully',
        status: 'approved'
      })
    } else {
      // 调用拒绝函数
      const { error } = await callRpc(supabase, 'reject_project', {
        project_id: projectId,
        reason: rejection_reason || ''
      })
      
      if (error) {
        throw error
      }
      
      return NextResponse.json({ 
        message: 'Project rejected',
        status: 'rejected'
      })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

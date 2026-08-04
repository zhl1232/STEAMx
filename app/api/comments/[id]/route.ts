import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createModerationCase, moderateUserContent } from '@/lib/safety/server'

/**
 * PATCH /api/comments/[id]
 * 编辑评论内容（仅作者可编辑）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-comments-edit', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const commentId = parseInt(id)
    if (Number.isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment id' }, { status: 400 })
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (content.length === 0) {
      return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '评论内容过长' }, { status: 400 })
    }

    validateContentSafe(content, '评论内容')

    const moderation = await moderateUserContent({ text: content })
    if (moderation.state === 'rejected') {
      return NextResponse.json(
        { error: moderation.reason || '评论未通过安全检查', code: 'CONTENT_REJECTED' },
        { status: 422 },
      )
    }
    if (moderation.state === 'pending' && !supabaseAdmin) {
      return NextResponse.json(
        { error: '审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const { data: row, error: fetchError } = await supabase
      .from('comments')
      .select('author_id, moderation_state')
      .eq('id', commentId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!row) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }
    const typedRow = row as { author_id: string; moderation_state?: string }
    if (typedRow.author_id !== user.id) {
      return NextResponse.json({ error: '无权编辑此评论' }, { status: 403 })
    }

    const { error } = await supabase
      .from('comments')
      .update({
        content,
        updated_at: new Date().toISOString(),
        moderation_state: typedRow.moderation_state === 'hidden' ? 'pending' : moderation.state,
      } as never)
      .eq('id', commentId)
      .eq('author_id', user.id)
    if (error) throw error

    if (typedRow.moderation_state === 'hidden' || moderation.state === 'pending') {
      const caseId = await createModerationCase({
        contentType: 'comment',
        contentId: commentId,
        authorId: user.id,
        riskLevel: moderation.riskLevel,
        category: moderation.category,
        reason: moderation.reason || '编辑后的评论需要重新审核',
        modelName: moderation.modelName,
        snapshot: { authorId: user.id, text: content, metadata: {} },
      })
      return NextResponse.json({ message: 'Comment queued for moderation', content, caseId }, { status: 202 })
    }

    return NextResponse.json({ message: 'Comment updated', content })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/comments/[id]
 * 删除评论
 * 用户可以删除自己的评论,管理员/版主可以删除任何评论
 * 权限由 RLS 策略控制
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-comments-delete', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const commentId = parseInt(id, 10)

    if (Number.isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment id' }, { status: 400 })
    }

    const { data: existingComment, error: existingError } = await supabase
      .from('comments')
      .select('id')
      .eq('id', commentId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const { data: deletedComment, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this comment' },
          { status: 403 }
        )
      }
      throw error
    }

    if (!deletedComment) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this comment' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      message: 'Comment deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}

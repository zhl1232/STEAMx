import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'

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

    const { data: row } = await supabase
      .from('comments')
      .select('author_id')
      .eq('id', commentId)
      .single()
    if (!row || (row as { author_id: string }).author_id !== user.id) {
      return NextResponse.json({ error: '无权编辑此评论' }, { status: 403 })
    }

    const { error } = await supabase
      .from('comments')
      .update({ content, updated_at: new Date().toISOString() } as never)
      .eq('id', commentId)
      .eq('author_id', user.id)
    if (error) throw error

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    // 检查用户认证
    await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-comments-delete', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const commentId = parseInt(id)
    
    // 直接执行删除,RLS 策略会自动检查权限
    // 策略: "Authors and moderators can delete comments"
    // - 如果是作者: auth.uid() = author_id 通过
    // - 如果是管理员/版主: is_moderator_or_admin() 通过
    // - 否则: 删除将被 RLS 拒绝
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
    
    if (error) {
      // 如果 RLS 策略拒绝,error.code 通常是权限相关错误
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this comment' },
          { status: 403 }
        )
      }
      throw error
    }
    
    return NextResponse.json({ 
      message: 'Comment deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}

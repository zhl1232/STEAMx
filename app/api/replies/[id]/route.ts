import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'

/**
 * PATCH /api/replies/[id]
 * 编辑讨论回复内容（仅作者可编辑）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-replies-edit', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const replyId = parseInt(id)
    if (Number.isNaN(replyId)) {
      return NextResponse.json({ error: 'Invalid reply id' }, { status: 400 })
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (content.length === 0) {
      return NextResponse.json({ error: '回复内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '回复内容过长' }, { status: 400 })
    }

    validateContentSafe(content, '回复内容')

    const { data: row } = await supabase
      .from('discussion_replies')
      .select('author_id')
      .eq('id', replyId)
      .single()
    if (!row || (row as { author_id: string }).author_id !== user.id) {
      return NextResponse.json({ error: '无权编辑此回复' }, { status: 403 })
    }

    const { error } = await supabase
      .from('discussion_replies')
      .update({ content, updated_at: new Date().toISOString() } as never)
      .eq('id', replyId)
      .eq('author_id', user.id)
    if (error) throw error

    return NextResponse.json({ message: 'Reply updated', content })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/replies/[id]
 * 删除讨论回复
 * 用户可以删除自己的回复,管理员/版主可以删除任何回复
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
    await requireRateLimit(supabase, { key: 'api-replies-delete', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const replyId = parseInt(id)
    
    // 直接执行删除,RLS 策略会自动检查权限
    // 策略会检查是否为作者或管理员/版主
    const { error } = await supabase
      .from('discussion_replies')
      .delete()
      .eq('id', replyId)
    
    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this reply' },
          { status: 403 }
        )
      }
      throw error
    }
    
    return NextResponse.json({ 
      message: 'Reply deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}

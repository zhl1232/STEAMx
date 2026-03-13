import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

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

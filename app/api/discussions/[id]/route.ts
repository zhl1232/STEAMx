import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

/**
 * DELETE /api/discussions/[id]
 * 删除讨论主题
 * 用户可以删除自己的讨论，管理员/版主可以删除任何讨论
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
    const { id } = await params
    const discussionId = parseInt(id)
    
    // 直接执行删除,RLS 策略会自动检查权限
    // 策略: 仅讨论作者或管理员/版主可删除 discussion 记录
    const { error } = await supabase
      .from('discussions')
      .delete()
      .eq('id', discussionId)
    
    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this discussion' },
          { status: 403 }
        )
      }
      throw error
    }
    
    return NextResponse.json({ 
      message: 'Discussion deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}

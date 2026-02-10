import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'

/**
 * POST /api/projects/[id]/like
 * 点赞/取消点赞项目
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const projectId = parseInt(id)
  
  try {
    // 检查用户认证
    const user = await requireAuth(supabase)
    
    // 检查是否已点赞
    const { data: existingLike } = await supabase
      .from('likes')
      .select()
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .single()
    
    if (existingLike) {
      // 取消点赞
      const { error: deleteError } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId)
      
      if (deleteError) {
        throw deleteError
      }
      
      // 减少点赞数
      await callRpc(supabase, 'decrement_project_likes', { project_id: projectId })
      
      return NextResponse.json({ liked: false, action: 'unliked' })
    } else {
      // 添加点赞
      const { error: insertError } = await supabase
        .from('likes')
        .insert({ user_id: user.id, project_id: projectId })
      
      if (insertError) {
        throw insertError
      }
      
      // 增加点赞数
      await callRpc(supabase, 'increment_project_likes', { project_id: projectId })
      
      return NextResponse.json({ liked: true, action: 'liked' })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/projects/[id]/like
 * 检查当前用户是否已点赞
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const projectId = parseInt(id)
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ liked: false })
  }
  
  const { data } = await supabase
    .from('likes')
    .select()
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .single()
  
  return NextResponse.json({ liked: !!data })
}

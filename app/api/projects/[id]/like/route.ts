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
  const projectId = parseInt(id, 10)
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }
  
  try {
    // 检查用户认证
    const user = await requireAuth(supabase)

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('author_id')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) {
      throw projectError
    }

    if (!projectRow) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if ((projectRow as { author_id: string }).author_id === user.id) {
      return NextResponse.json({ error: '不能给自己的项目点赞' }, { status: 403 })
    }
    
    // 检查是否已点赞
    const { data: existingLike, error: existingLikeError } = await supabase
      .from('likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()
    
    if (existingLikeError) {
      throw existingLikeError
    }
    
    if (existingLike) {
      // 取消点赞
      const { data: deletedRows, error: deleteError } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .select('user_id')
      
      if (deleteError) {
        throw deleteError
      }
      
      if (deletedRows && deletedRows.length > 0) {
        const { error: rpcError } = await callRpc(supabase, 'decrement_project_likes', { project_id: projectId })
        if (rpcError) throw rpcError
      }
      
      return NextResponse.json({ liked: false, action: 'unliked' })
    } else {
      // 添加点赞
      const { data: insertedRows, error: insertError } = await supabase
        .from('likes')
        .insert({ user_id: user.id, project_id: projectId } as never)
        .select('user_id')
      
      if (insertError) {
        if ((insertError as { code?: string }).code === '23505') {
          return NextResponse.json({ liked: true, action: 'liked' })
        }
        throw insertError
      }
      
      if (insertedRows && insertedRows.length > 0) {
        const { error: rpcError } = await callRpc(supabase, 'increment_project_likes', { project_id: projectId })
        if (rpcError) throw rpcError
      }
      
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
  const projectId = parseInt(id, 10)
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ liked: false })
  }
  
  const { data, error } = await supabase
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return handleApiError(error)
  }
  
  return NextResponse.json({ liked: !!data })
}

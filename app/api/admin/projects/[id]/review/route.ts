import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'
import { callRpc } from '@/lib/supabase/rpc'

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
    const projectId = parseInt(id)
    
    if (action === 'approve') {
      const { error } = await callRpc(supabase, 'approve_project', {
        project_id: projectId
      })
      
      if (error) {
        throw error
      }

      // Trigger evergreen challenge completion if applicable
      const { data: project } = await supabase
        .from('projects')
        .select('author_id, challenge_id')
        .eq('id', projectId)
        .single()

      if (project) {
        const proj = project as { author_id: string; challenge_id: number | null }
        if (proj.challenge_id) {
          const { data: ch } = await supabase
            .from('challenges')
            .select('challenge_type, status')
            .eq('id', proj.challenge_id)
            .single()

          if (ch && (ch as { challenge_type: string; status: string }).challenge_type === 'evergreen'
            && (ch as { challenge_type: string; status: string }).status === 'active') {
            const { error: rpcError } = await (supabase.rpc as unknown as (
              fn: string, args: unknown
            ) => PromiseLike<{ data: unknown; error: unknown }>)(
              'complete_evergreen_challenge',
              { p_user_id: proj.author_id, p_challenge_id: proj.challenge_id, p_project_id: projectId }
            )
            if (rpcError) throw rpcError
          }
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

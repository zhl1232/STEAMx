import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'

/**
 * DELETE /api/admin/tags/[id]
 * 删除标签
 * 需要审核员或管理员权限
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    // 检查用户权限
    await requireRole(supabase, ['moderator', 'admin'])
    
    const { id } = await params
    const tagId = validateNumber(id, 'Tag id', { min: 1, integer: true })

    const { data, error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .select('id')
      .maybeSingle()
    
    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      message: 'Tag deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}

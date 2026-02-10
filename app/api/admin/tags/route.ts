import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateRequiredString, validateOptionalString } from '@/lib/api/validation'

/**
 * GET /api/admin/tags
 * 获取所有标签
 */
export async function GET() {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/admin/tags
 * 创建新标签
 * 需要审核员或管理员权限
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  try {
    // 检查用户权限
    const { user } = await requireRole(supabase, ['moderator', 'admin'])
    
    const body = await request.json()
    
    // 验证输入
    const name = validateRequiredString(body.name, 'Tag name', 50)
    const category = validateOptionalString(body.category, 'Category', 50)
    
    const { data, error } = await supabase
      .from('tags')
      .insert({
        name,
        category,
        created_by: user.id
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

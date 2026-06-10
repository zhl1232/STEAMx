import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import {
  validateOptionalString,
  validateEnum,
  validateNumber,
} from '@/lib/api/validation'
import {
  LEARNING_RESOURCE_CATEGORIES,
  LEARNING_RESOURCE_STATUSES,
} from '@/lib/learning-resources'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const resourceId = validateNumber(id, 'Resource id', { min: 1, integer: true })
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      updateData.title = validateOptionalString(body.title, 'Title', 120)
    }
    if (body.summary !== undefined) {
      updateData.summary = validateOptionalString(body.summary, 'Summary', 300) || null
    }
    if (body.content_md !== undefined) {
      updateData.content_md = validateOptionalString(body.content_md, 'Content', 20000)
    }
    if (body.category !== undefined) {
      updateData.category = validateEnum(body.category, 'Category', LEARNING_RESOURCE_CATEGORIES)
    }
    if (body.cover_image_url !== undefined) {
      updateData.cover_image_url = validateOptionalString(body.cover_image_url, 'Cover image URL', 500) || null
    }
    if (body.status !== undefined) {
      updateData.status = validateEnum(body.status, 'Status', LEARNING_RESOURCE_STATUSES)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('learning_resources')
      .update(updateData as never)
      .eq('id', resourceId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    return NextResponse.json({ resource: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const resourceId = validateNumber(id, 'Resource id', { min: 1, integer: true })

    const { data: resource, error: fetchError } = await supabase
      .from('learning_resources')
      .select('status')
      .eq('id', resourceId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // 已发布资料卡可能被挑战脚手架引用，删除会产生死链；先下架为草稿再删除
    if ((resource as { status: string }).status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft resources can be deleted' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('learning_resources')
      .delete()
      .eq('id', resourceId)

    if (error) throw error

    return NextResponse.json({ message: 'Resource deleted' })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import {
  validateRequiredString,
  validateOptionalString,
  validateEnum,
} from '@/lib/api/validation'
import {
  LEARNING_RESOURCE_CATEGORIES,
  LEARNING_RESOURCE_STATUSES,
} from '@/lib/learning-resources'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    let query = supabase
      .from('learning_resources')
      .select('*')
      .order('updated_at', { ascending: false })

    if (statusFilter && (LEARNING_RESOURCE_STATUSES as readonly string[]).includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ resources: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const body = await request.json()

    const insertData = {
      title: validateRequiredString(body.title, 'Title', 120),
      summary: validateOptionalString(body.summary, 'Summary', 300) || null,
      content_md: validateRequiredString(body.content_md, 'Content', 20000),
      category: validateEnum(body.category, 'Category', LEARNING_RESOURCE_CATEGORIES),
      cover_image_url: validateOptionalString(body.cover_image_url, 'Cover image URL', 500) || null,
      status: body.status !== undefined
        ? validateEnum(body.status, 'Status', LEARNING_RESOURCE_STATUSES)
        : 'draft',
    }

    const { data, error } = await supabase
      .from('learning_resources')
      .insert(insertData as never)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ resource: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

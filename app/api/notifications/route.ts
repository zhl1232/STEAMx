import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole, handleApiError } from '@/lib/api/auth'

const PAGE_SIZE = 20
const USER_ALLOWED_TYPES = new Set(['mention', 'reply', 'like', 'follow'])
const ALLOWED_TYPES = new Set([
  ...USER_ALLOWED_TYPES,
  'system',
  'creator_update',
])
const ALLOWED_RELATED_TYPES = new Set([
  'comment',
  'discussion_reply',
  'project',
  'discussion',
])

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const searchParams = request.nextUrl.searchParams
    const before = searchParams.get('before')

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw error

    const list = (data || []) as Record<string, unknown>[]
    const hasMore = list.length === PAGE_SIZE

    return NextResponse.json({ notifications: list, hasMore })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json()

    const userId = typeof body?.user_id === 'string' ? body.user_id : null
    const type = typeof body?.type === 'string' ? body.type : null
    const content =
      typeof body?.content === 'string' ? body.content.trim() : ''

    if (!userId || !type || !content) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const isSystem = type === 'system'
    const isCreatorUpdate = type === 'creator_update'
    if (isSystem) {
      await requireRole(supabase, ['moderator', 'admin'])
    } else if (isCreatorUpdate) {
      await requireRole(supabase, ['teacher', 'moderator', 'admin'])
    }

    const relatedType =
      typeof body?.related_type === 'string' ? body.related_type : null
    if (relatedType && !ALLOWED_RELATED_TYPES.has(relatedType)) {
      return NextResponse.json(
        { error: 'Invalid related_type' },
        { status: 400 }
      )
    }

    const toNumber = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null
      const num = Number(value)
      return Number.isNaN(num) ? null : num
    }

    let fromUsername: string | null = null
    let fromAvatar: string | null = null
    if (isSystem) {
      fromUsername = '系统'
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const fallbackName = user.email?.split('@')[0] || null
      const fallbackAvatar =
        typeof user.user_metadata?.avatar_url === 'string'
          ? user.user_metadata.avatar_url
          : null

      fromUsername = profile?.display_name || fallbackName
      fromAvatar = profile?.avatar_url || fallbackAvatar
    }

    const payload = {
      user_id: userId,
      type,
      content,
      related_type: relatedType,
      related_id: toNumber(body?.related_id),
      project_id: toNumber(body?.project_id),
      discussion_id: toNumber(body?.discussion_id),
      from_user_id: isSystem ? null : user.id,
      from_username: fromUsername,
      from_avatar: fromAvatar,
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert(payload as never)
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, id: data?.id ?? null })
  } catch (error) {
    return handleApiError(error)
  }
}

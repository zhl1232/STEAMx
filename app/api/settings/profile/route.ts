import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'
import {
  isOwnedAvatarUrl,
  ProfileSettingsUpdateSchema,
  splitBirthDate,
  toBirthDate,
} from '@/lib/profile/settings'
import { createClient } from '@/lib/supabase/server'

type ProfileSettingsRow = {
  username: string | null
  display_name: string | null
  bio: string | null
  gender: string | null
  birth_date: string | null
  avatar_url: string | null
  last_uploaded_avatar_url?: string | null
}

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, bio, gender, birth_date, avatar_url, last_uploaded_avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: '个人资料不存在' }, { status: 404 })
    }

    const row = data as ProfileSettingsRow
    const { birthYear, birthMonth } = splitBirthDate(row.birth_date)

    return NextResponse.json({
      profile: {
        username: row.username,
        display_name: row.display_name ?? '',
        bio: row.bio ?? '',
        gender: row.gender ?? null,
        birth_year: birthYear,
        birth_month: birthMonth,
        avatar_url: row.avatar_url,
        last_uploaded_avatar_url: row.last_uploaded_avatar_url ?? null,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'settings-profile-update',
      limit: 10,
      windowMs: 60_000,
    })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 })
    }
    const parsed = ProfileSettingsUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      )
    }

    const payload = parsed.data
    validateContentSafe(payload.display_name, '昵称')
    if (payload.bio) {
      validateContentSafe(payload.bio, '简介')
    }

    if (!isOwnedAvatarUrl(payload.avatar_url, user.id)) {
      return NextResponse.json(
        { error: '头像必须使用当前账号上传的文件或默认头像' },
        { status: 400 },
      )
    }

    const birthDate = toBirthDate(payload.birth_year, payload.birth_month)
    const isCustomUpload = !payload.avatar_url.startsWith('/avatars/')
    const updatePayload = {
      display_name: payload.display_name,
      bio: payload.bio || null,
      gender: payload.gender,
      birth_date: birthDate,
      avatar_url: payload.avatar_url,
      updated_at: new Date().toISOString(),
      ...(isCustomUpload
        ? { last_uploaded_avatar_url: payload.avatar_url }
        : {}),
    } as {
      avatar_url: string
      bio: string | null
      birth_date: string | null
      display_name: string
      gender: string | null
      last_uploaded_avatar_url?: string
      updated_at: string
    }

    if (!isCustomUpload) {
      delete updatePayload.last_uploaded_avatar_url
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload as never)
      .eq('id', user.id)
      .select('username, display_name, bio, gender, birth_date, avatar_url, last_uploaded_avatar_url')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: '个人资料不存在' }, { status: 404 })
    }

    const row = data as ProfileSettingsRow
    const { birthYear, birthMonth } = splitBirthDate(row.birth_date)

    return NextResponse.json({
      profile: {
        username: row.username,
        display_name: row.display_name ?? '',
        bio: row.bio ?? '',
        gender: row.gender ?? null,
        birth_year: birthYear,
        birth_month: birthMonth,
        avatar_url: row.avatar_url,
        last_uploaded_avatar_url: row.last_uploaded_avatar_url ?? null,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

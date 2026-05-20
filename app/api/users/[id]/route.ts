import { NextRequest, NextResponse } from 'next/server'

import {
  getPublicUserProfile,
  PUBLIC_PROFILE_PROJECTS_PAGE_SIZE,
} from '@/lib/api/public-user-profile'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const searchParams = _request.nextUrl.searchParams
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const pageSize = Math.min(
      PUBLIC_PROFILE_PROJECTS_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(PUBLIC_PROFILE_PROJECTS_PAGE_SIZE), 10) || PUBLIC_PROFILE_PROJECTS_PAGE_SIZE),
    )
    const data = await getPublicUserProfile(id, { page, pageSize })

    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error('Error in GET /api/users/[id]', { error })
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
  }
}

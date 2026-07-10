import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { getWorkById } from '@/lib/works/data'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid work id' }, { status: 400 })
    }
    const work = await getWorkById(id)
    if (!work) return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    return NextResponse.json({ work })
  } catch (error) {
    return handleApiError(error)
  }
}

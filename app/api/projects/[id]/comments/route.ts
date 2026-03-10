import { NextRequest, NextResponse } from 'next/server'
import { getProjectComments } from '@/lib/api/explore-data'

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
    }
    const projectId = Number(id)
    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseNumber(searchParams.get('page'), 0)
    const pageSize = Math.min(50, Math.max(1, parseNumber(searchParams.get('pageSize'), 5)))

    const data = await getProjectComments(projectId, page, pageSize)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

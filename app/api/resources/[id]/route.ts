import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'
import { getPublishedLearningResource } from '@/lib/api/learning-resources'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const resourceId = validateNumber(id, 'Resource id', { min: 1, integer: true })

    const resource = await getPublishedLearningResource(resourceId)

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    return NextResponse.json({ resource })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('discussions')
      .select('tags')
      .limit(200)

    if (error) throw error

    const allTags = ((data as { tags: string[] | null }[] | null) || [])
      .flatMap((row) => row.tags || [])
      .map((tag) => tag.trim())
      .filter(Boolean)

    const uniqueTags = Array.from(new Set(allTags)).slice(0, 10)

    return NextResponse.json({ tags: uniqueTags })
  } catch (error) {
    console.error('Error in GET /api/discussions/tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

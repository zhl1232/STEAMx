import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Challenge } from '@/lib/mappers/types'

type ChallengeRow = {
  id: number
  title: string
  description: string | null
  image_url: string | null
  participants_count: number
  end_date: string | null
  tags: string[] | null
  created_at?: string | null
}

function mapChallenge(row: ChallengeRow, joined: boolean): Challenge {
  const endDate = row.end_date ? new Date(row.end_date) : null
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    image: row.image_url || '',
    participants: row.participants_count,
    daysLeft,
    endDate: row.end_date ?? undefined,
    joined,
    tags: row.tags || [],
  }
}

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: challengeRows, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (challengeError) throw challengeError

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let joinedIds = new Set<number>()
    if (user) {
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id)

      if (participants) {
        joinedIds = new Set(
          (participants as { challenge_id: number }[]).map((row) => row.challenge_id)
        )
      }
    }

    const challenges = ((challengeRows as ChallengeRow[] | null) || []).map((row) =>
      mapChallenge(row, joinedIds.has(row.id))
    )

    return NextResponse.json({ challenges })
  } catch (error) {
    console.error('Error in GET /api/challenges:', error)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}

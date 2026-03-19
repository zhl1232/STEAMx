import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapDbChallenge } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: challengeRows, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .in('status', ['active', 'ended'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (challengeError) throw challengeError

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let joinedIds = new Set<number>()
    let completedIds = new Set<number>()

    if (user) {
      const [{ data: participants }, { data: completions }] = await Promise.all([
        supabase.from('challenge_participants').select('challenge_id').eq('user_id', user.id),
        supabase.from('challenge_completions').select('challenge_id').eq('user_id', user.id),
      ])

      if (participants) {
        joinedIds = new Set((participants as { challenge_id: number }[]).map(r => r.challenge_id))
      }
      if (completions) {
        completedIds = new Set((completions as { challenge_id: number }[]).map(r => r.challenge_id))
      }
    }

    const rows = (challengeRows || []) as Record<string, unknown>[]

    const activeTimed = rows
      .filter(r => r.challenge_type === 'timed' && r.status === 'active')
      .map(r => mapDbChallenge(r as never, joinedIds.has(r.id as number), false))

    const evergreen = rows
      .filter(r => r.challenge_type === 'evergreen' && r.status === 'active')
      .map(r => mapDbChallenge(r as never, joinedIds.has(r.id as number), completedIds.has(r.id as number)))

    const ended = rows
      .filter(r => r.status === 'ended')
      .map(r => mapDbChallenge(r as never, joinedIds.has(r.id as number), false))

    return NextResponse.json({ activeTimed, evergreen, ended })
  } catch (error) {
    logger.error('Error in GET /api/challenges', { error })
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}

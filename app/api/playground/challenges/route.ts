import { challengeApiError } from '@/lib/playground/challenge-errors'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { activeChallenge,enterChallenge } from '@/lib/playground/challenge-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request){try{const user=await requireAuth(await createClient());const game=new URL(request.url).searchParams.get('game');if(game!=='gomoku'&&game!=='memory')return NextResponse.json({error:'invalid_game'},{status:400});return NextResponse.json(await activeChallenge(user.id,game),{headers:{'Cache-Control':'no-store'}})}catch(error){return challengeApiError(error)}}
export async function POST(request:Request){try{const client=await createClient();const user=await requireAuth(client);await requireRateLimit(client,{key:'challenge-enter',limit:30,windowMs:60000});return NextResponse.json(await enterChallenge(user.id,await request.json()))}catch(error){return challengeApiError(error)}}

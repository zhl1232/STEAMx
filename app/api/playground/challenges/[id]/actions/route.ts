import { challengeApiError } from '@/lib/playground/challenge-errors'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { actChallenge } from '@/lib/playground/challenge-server'
export const runtime='nodejs'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const client=await createClient();const user=await requireAuth(client);await requireRateLimit(client,{key:'challenge-action',limit:240,windowMs:60000});return NextResponse.json(await actChallenge(user.id,(await params).id,await request.json()))}catch(error){return challengeApiError(error)}}

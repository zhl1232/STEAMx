import { challengeApiError } from '@/lib/playground/challenge-errors'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { getChallenge } from '@/lib/playground/challenge-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireAuth(await createClient());return NextResponse.json(await getChallenge(user.id,(await params).id),{headers:{'Cache-Control':'no-store'}})}catch(error){return challengeApiError(error)}}

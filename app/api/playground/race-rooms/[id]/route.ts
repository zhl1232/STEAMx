import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { validateUUID } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
    castRaceMatch,
    finishRaceMatchIfComplete,
    serviceUnavailable,
    settleExpiredRaceMatches,
} from "@/app/api/playground/race-rooms/_shared"

// 权威读取会先结算截止房间；竞速客户端的 4 秒轮询通过这里推进异常生命周期。
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        await requireAuth(supabase)
        const { id } = await params
        const matchId = validateUUID(id, "match id")

        const { data: existing, error: existingError } = await supabase
            .from("playground_race_matches")
            .select("id")
            .eq("id", matchId)
            .maybeSingle()
        if (existingError || !existing) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        if (!supabaseAdmin) return serviceUnavailable()
        await settleExpiredRaceMatches(matchId)

        const { data, error } = await supabase
            .from("playground_race_matches")
            .select("*")
            .eq("id", matchId)
            .single()
        if (error || !data) throw error ?? new Error("Race match not found")

        const match = await finishRaceMatchIfComplete(castRaceMatch(data))
        return NextResponse.json(match)
    } catch (error) {
        return handleApiError(error)
    }
}

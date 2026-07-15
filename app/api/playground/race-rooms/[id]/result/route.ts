import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { validateUUID } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
    badRequest,
    castRaceMatch,
    finishRaceMatchIfComplete,
    getRaceRole,
    parseRaceResult,
    settleExpiredRaceMatches,
    serviceUnavailable,
    submitRaceResultBeforeDeadline,
} from "@/app/api/playground/race-rooms/_shared"

// 提交通用竞速成绩。双方成绩都到齐后，服务端按 game_key 对应规则计算 winner 并结束房间。
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-playground-race-result",
            limit: 60,
            windowMs: 60_000,
        })

        if (!supabaseAdmin) return serviceUnavailable()

        const { id } = await params
        const matchId = validateUUID(id, "match id")

        await settleExpiredRaceMatches(matchId)

        const { data, error } = await supabase
            .from("playground_race_matches")
            .select("*")
            .eq("id", matchId)
            .maybeSingle()

        if (error || !data) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        let match = castRaceMatch(data)
        const role = getRaceRole(match, user.id)
        if (!role) {
            return NextResponse.json({ error: "无权操作该对局" }, { status: 403 })
        }

        if (match.status === "finished" || match.status === "cancelled") {
            return NextResponse.json({ match })
        }
        if (match.status !== "playing") {
            return NextResponse.json({ error: "对局尚未开始" }, { status: 409 })
        }

        match = await finishRaceMatchIfComplete(match)
        if (match.status === "finished" || match.status === "cancelled") {
            return NextResponse.json({ match })
        }

        const ownResult = role === "host" ? match.host_result : match.guest_result
        if (ownResult) {
            return NextResponse.json({ match })
        }

        const body = await request.json().catch(() => null)
        let result
        try {
            result = parseRaceResult(match.game_key, body?.result, match.settings)
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : "成绩不合法")
        }

        const submitted = await submitRaceResultBeforeDeadline(match.id, role, result)
        if (!submitted) await settleExpiredRaceMatches(match.id)

        const { data: freshData, error: freshError } = await supabaseAdmin
            .from("playground_race_matches")
            .select("*")
            .eq("id", match.id)
            .single()

        if (freshError || !freshData) throw freshError
        const fresh = await finishRaceMatchIfComplete(castRaceMatch(freshData))
        return NextResponse.json({ match: fresh })
    } catch (error) {
        return handleApiError(error)
    }
}

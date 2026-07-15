import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateRoomCode } from "@/lib/playground/race-online"
import {
    badRequest,
    parseRaceGameKey,
    parseRaceSettings,
    raceSettingsEqual,
    serviceUnavailable,
} from "@/app/api/playground/race-rooms/_shared"
import type { Json } from "@/lib/supabase/types"

// 创建通用联网竞速房间。房主选择游戏和公平比较设置，等待对手凭 6 位码加入。
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-playground-race-room-create",
            limit: 12,
            windowMs: 60_000,
        })

        const body = await request.json().catch(() => null)
        let gameKey
        let settings
        try {
            gameKey = parseRaceGameKey(body?.game_key)
            settings = parseRaceSettings(gameKey, body?.settings)
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : "参数不合法")
        }

        const { data: existing } = await supabase
            .from("playground_race_matches")
            .select("id, code, settings")
            .eq("host_user_id", user.id)
            .eq("game_key", gameKey)
            .eq("status", "waiting")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existing) {
            if (!raceSettingsEqual(existing.settings as typeof settings, settings)) {
                if (!supabaseAdmin) return serviceUnavailable()
                const { error: updateError } = await supabaseAdmin
                    .from("playground_race_matches")
                    .update({
                        settings: settings as unknown as Json,
                        host_result: null,
                        guest_result: null,
                        winner: null,
                    })
                    .eq("id", existing.id)
                    .eq("status", "waiting")
                if (updateError) throw updateError
            }
            return NextResponse.json({
                id: existing.id,
                code: existing.code,
                game_key: gameKey,
                settings,
            })
        }

        let code = generateRoomCode()
        for (let attempt = 0; attempt < 4; attempt++) {
            const { error } = await supabase.from("playground_race_matches").insert({
                code,
                game_key: gameKey,
                host_user_id: user.id,
                status: "waiting",
                settings: settings as unknown as Json,
            })
            if (!error) {
                const { data, error: selectError } = await supabase
                    .from("playground_race_matches")
                    .select("id")
                    .eq("code", code)
                    .single()
                if (!selectError && data) {
                    return NextResponse.json({
                        id: data.id,
                        code,
                        game_key: gameKey,
                        settings,
                    })
                }
            }
            code = generateRoomCode()
        }

        return NextResponse.json({ error: "创建房间失败，请重试" }, { status: 500 })
    } catch (error) {
        return handleApiError(error)
    }
}

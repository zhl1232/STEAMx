import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { validateRequiredString } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
    badRequest,
    castRaceMatch,
    parseRaceGameKey,
    serviceUnavailable,
} from "@/app/api/playground/race-rooms/_shared"

// 按 6 位房间码加入通用竞速房间。加入成功即进入 playing。
// 按码查询必须用 service role：未加入用户还不是 host/guest，普通 RLS 会隐藏有效房间。
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-playground-race-room-join",
            limit: 20,
            windowMs: 60_000,
        })

        if (!supabaseAdmin) return serviceUnavailable()

        const body = await request.json().catch(() => null)
        const code = validateRequiredString(body?.code, "code", 6).toUpperCase()
        let requestedGameKey
        try {
            requestedGameKey = parseRaceGameKey(body?.game_key)
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : "game_key is invalid")
        }

        const { data, error } = await supabaseAdmin
            .from("playground_race_matches")
            .select("id, code, game_key, host_user_id, guest_user_id, status, settings")
            .eq("code", code)
            .maybeSingle()

        if (error || !data) {
            return NextResponse.json({ error: "房间不存在" }, { status: 404 })
        }

        const match = castRaceMatch(data)
        if (match.game_key !== requestedGameKey) {
            return NextResponse.json({ error: "房间不属于当前游戏" }, { status: 409 })
        }

        if (match.status !== "waiting") {
            if (match.host_user_id === user.id || match.guest_user_id === user.id) {
                return NextResponse.json({
                    id: match.id,
                    code,
                    status: match.status,
                    game_key: match.game_key,
                    settings: match.settings,
                })
            }
            return NextResponse.json({ error: "房间已开始或已结束" }, { status: 409 })
        }

        if (match.host_user_id === user.id) {
            const { data: fresh } = await supabase
                .from("playground_race_matches")
                .select("id, code, status, game_key, settings")
                .eq("id", match.id)
                .single()
            return NextResponse.json(fresh)
        }

        if (match.guest_user_id && match.guest_user_id !== user.id) {
            return NextResponse.json({ error: "房间已满" }, { status: 409 })
        }

        const { count, error: joinError } = await supabaseAdmin
            .from("playground_race_matches")
            .update(
                {
                    guest_user_id: user.id,
                    status: "playing",
                    started_at: new Date().toISOString(),
                },
                { count: "exact" },
            )
            .eq("id", match.id)
            .eq("status", "waiting")
            .is("guest_user_id", null)

        if (joinError) throw joinError
        if (!count || count === 0) {
            return NextResponse.json(
                { error: "加入失败，房间已被他人加入或已关闭" },
                { status: 409 },
            )
        }

        return NextResponse.json({
            id: match.id,
            code,
            status: "playing",
            game_key: match.game_key,
            settings: match.settings,
        })
    } catch (error) {
        return handleApiError(error)
    }
}

import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
    buildOnlineDeck,
    generateRoomCode,
    isMemoryDifficulty,
    isMemoryTheme,
    type MemoryDifficulty,
    type MemoryTheme,
} from "@/lib/playground/memory-online"

// 创建记忆翻牌在线对战房间。房主选主题 + 难度，服务端建牌洗牌后入库。
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-memory-room-create",
            limit: 10,
            windowMs: 60_000,
        })

        let theme: MemoryTheme = "animals"
        let difficulty: MemoryDifficulty = "easy"
        try {
            const body = await request.json()
            if (isMemoryTheme(body?.theme)) theme = body.theme
            if (isMemoryDifficulty(body?.difficulty)) difficulty = body.difficulty
        } catch {
            // body 为空或不合法时用默认值，不阻断建房
        }

        // 房主已有一个 waiting 对局时复用，避免堆积空房；若主题/难度变了则重建牌堆。
        const { data: existing } = await supabase
            .from("memory_matches")
            .select("id, code, theme, difficulty")
            .eq("host_user_id", user.id)
            .eq("status", "waiting")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existing) {
            if (existing.theme !== theme || existing.difficulty !== difficulty) {
                if (!supabaseAdmin) {
                    return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
                }
                const { error: updateError } = await supabaseAdmin
                    .from("memory_matches")
                    .update({
                        theme,
                        difficulty,
                        deck: buildOnlineDeck(theme, difficulty),
                        current_turn: "host",
                        first_flip: null,
                        last_result: null,
                        result_seq: 0,
                        scores: { host: 0, guest: 0 },
                        winner: null,
                    })
                    .eq("id", existing.id)
                    .eq("status", "waiting")
                if (updateError) throw updateError
            }
            return NextResponse.json({ id: existing.id, code: existing.code, theme, difficulty })
        }

        let code = generateRoomCode()
        for (let attempt = 0; attempt < 4; attempt++) {
            const { error } = await supabase.from("memory_matches").insert({
                code,
                host_user_id: user.id,
                status: "waiting",
                theme,
                difficulty,
                deck: buildOnlineDeck(theme, difficulty),
                current_turn: "host",
                scores: { host: 0, guest: 0 },
            })
            if (!error) {
                const { data, error: selectError } = await supabase
                    .from("memory_matches")
                    .select("id")
                    .eq("code", code)
                    .single()
                if (!selectError && data) {
                    return NextResponse.json({ id: data.id, code, theme, difficulty })
                }
            }
            // 命中唯一约束冲突则换码重试
            code = generateRoomCode()
        }

        return NextResponse.json({ error: "创建房间失败，请重试" }, { status: 500 })
    } catch (error) {
        return handleApiError(error)
    }
}

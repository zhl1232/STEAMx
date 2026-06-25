import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { validateEnum } from "@/lib/api/validation"
import { createClient } from "@/lib/supabase/server"
import { createEmptyBoard, generateRoomCode, type GomokuColor } from "@/lib/playground/gomoku-online"

// 创建五子棋在线对战房间。房主可选执子颜色，默认黑。
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-gomoku-room-create",
            limit: 10,
            windowMs: 60_000,
        })

        let hostColor: GomokuColor = "black"
        try {
            const body = await request.json()
            const candidate = validateEnum(body?.host_color, "host_color", ["black", "white"] as const)
            hostColor = candidate
        } catch {
            // body 为空或不合法时默认黑棋，不阻断建房
        }

        // 房主已有一个 waiting 对局时复用，避免堆积空房
        const { data: existing } = await supabase
            .from("gomoku_matches")
            .select("id, code, host_color")
            .eq("host_user_id", user.id)
            .eq("status", "waiting")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        // 房主已有一个 waiting 对局时复用，避免堆积空房。
        // 若本次请求的执子颜色与旧房间不同，先更新 host_color 再返回。
        if (existing) {
            if (existing.host_color !== hostColor) {
                const { error: updateColorError } = await supabase
                    .from("gomoku_matches")
                    .update({ host_color: hostColor })
                    .eq("id", existing.id)
                    .eq("status", "waiting")
                if (updateColorError) throw updateColorError
            }
            return NextResponse.json({
                id: existing.id,
                code: existing.code,
                host_color: hostColor,
            })
        }

        let code = generateRoomCode()
        for (let attempt = 0; attempt < 4; attempt++) {
            const { error } = await supabase.from("gomoku_matches").insert({
                code,
                host_user_id: user.id,
                status: "waiting",
                board: createEmptyBoard(),
                current_turn: "black",
                host_color: hostColor,
            })
            if (!error) {
                const { data, error: selectError } = await supabase
                    .from("gomoku_matches")
                    .select("id")
                    .eq("code", code)
                    .single()
                if (!selectError && data) {
                    return NextResponse.json({ id: data.id, code, host_color: hostColor })
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

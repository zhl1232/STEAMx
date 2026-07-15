import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { validateUUID } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// 退出对局：
//   - waiting：仅房主可取消 → cancelled
//   - playing 且未结束：退出者判负，对方判胜 → finished
//   - finished/cancelled：幂等返回当前状态
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        const { id } = await params
        const matchId = validateUUID(id, "match id")

        const { data: match, error } = await supabase
            .from("memory_matches")
            .select("id, host_user_id, guest_user_id, status")
            .eq("id", matchId)
            .maybeSingle()

        if (error || !match) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        const isHost = match.host_user_id === user.id
        const isGuest = match.guest_user_id === user.id
        if (!isHost && !isGuest) {
            return NextResponse.json({ error: "无权操作该对局" }, { status: 403 })
        }

        if (match.status === "waiting") {
            if (!isHost) {
                return NextResponse.json({ error: "无权取消该房间" }, { status: 403 })
            }
            if (!supabaseAdmin) {
                return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
            }
            const { error: cancelError } = await supabaseAdmin
                .from("memory_matches")
                .update({ status: "cancelled", finished_at: new Date().toISOString() })
                .eq("id", matchId)
                .eq("status", "waiting")
            if (cancelError) throw cancelError
            return NextResponse.json({ id: matchId, status: "cancelled" })
        }

        if (match.status === "playing") {
            // 退出者判负：对方角色获胜
            const winnerRole = isHost ? "guest" : "host"

            if (!supabaseAdmin) {
                return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
            }
            const { count, error: finishError } = await supabaseAdmin
                .from("memory_matches")
                .update(
                    {
                        status: "finished",
                        winner: winnerRole,
                        finished_at: new Date().toISOString(),
                    },
                    { count: "exact" },
                )
                .eq("id", matchId)
                .eq("status", "playing")
            if (finishError) throw finishError
            if (!count || count === 0) {
                // 对局状态已变（对方同时退出或已结束），返回当前状态
                const { data: current } = await supabase
                    .from("memory_matches")
                    .select("status, winner")
                    .eq("id", matchId)
                    .single()
                return NextResponse.json({
                    id: matchId,
                    status: current?.status ?? "finished",
                    winner: current?.winner ?? null,
                })
            }
            return NextResponse.json({ id: matchId, status: "finished", winner: winnerRole })
        }

        // finished/cancelled：幂等
        return NextResponse.json({ id: matchId, status: match.status })
    } catch (error) {
        return handleApiError(error)
    }
}

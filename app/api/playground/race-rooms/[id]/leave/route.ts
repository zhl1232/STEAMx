import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { validateUUID } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
    castRaceMatch,
    getRaceRole,
    oppositeRaceRole,
    serviceUnavailable,
} from "@/app/api/playground/race-rooms/_shared"

// 退出竞速房间：
//   - waiting：仅房主可取消；
//   - playing：退出方视为认输，对方获胜；
//   - finished/cancelled：幂等返回。
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        const { id } = await params
        const matchId = validateUUID(id, "match id")

        const { data, error } = await supabase
            .from("playground_race_matches")
            .select("*")
            .eq("id", matchId)
            .maybeSingle()

        if (error || !data) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        const match = castRaceMatch(data)
        const role = getRaceRole(match, user.id)
        if (!role) {
            return NextResponse.json({ error: "无权操作该对局" }, { status: 403 })
        }

        if (match.status === "waiting") {
            if (role !== "host") {
                return NextResponse.json({ error: "无权取消该房间" }, { status: 403 })
            }
            if (!supabaseAdmin) return serviceUnavailable()
            const { error: cancelError } = await supabaseAdmin
                .from("playground_race_matches")
                .update({ status: "cancelled", finished_at: new Date().toISOString() })
                .eq("id", match.id)
                .eq("status", "waiting")
            if (cancelError) throw cancelError
            return NextResponse.json({ id: match.id, status: "cancelled" })
        }

        if (match.status === "playing") {
            if (!supabaseAdmin) return serviceUnavailable()
            const winner = oppositeRaceRole(role)
            const { count, error: finishError } = await supabaseAdmin
                .from("playground_race_matches")
                .update(
                    {
                        status: "finished",
                        winner,
                        finished_at: new Date().toISOString(),
                    },
                    { count: "exact" },
                )
                .eq("id", match.id)
                .eq("status", "playing")
            if (finishError) throw finishError

            if (!count || count === 0) {
                const { data: current } = await supabase
                    .from("playground_race_matches")
                    .select("status, winner")
                    .eq("id", match.id)
                    .single()
                return NextResponse.json({
                    id: match.id,
                    status: current?.status ?? "finished",
                    winner: current?.winner ?? null,
                })
            }
            return NextResponse.json({ id: match.id, status: "finished", winner })
        }

        return NextResponse.json({ id: match.id, status: match.status, winner: match.winner })
    } catch (error) {
        return handleApiError(error)
    }
}

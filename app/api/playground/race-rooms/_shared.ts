import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import type { Json } from "@/lib/supabase/types"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { callRpc } from "@/lib/supabase/rpc"
import {
    decideRaceWinner,
    isRaceGameKey,
    normalizeRaceResult,
    normalizeRaceSettings,
    oppositeRaceRole,
    type RaceGameKey,
    type RaceMatchRow,
    type RaceResult,
    type RaceRole,
    type RaceSettings,
} from "@/lib/playground/race-online"

export { oppositeRaceRole }

export function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 })
}

export function serviceUnavailable() {
    return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
}

type RaceLifecycleCounts = {
    waiting_cancelled: number
    result_timeout_finished: number
    no_result_timeout_cancelled: number
}

const EMPTY_LIFECYCLE_COUNTS: RaceLifecycleCounts = {
    waiting_cancelled: 0,
    result_timeout_finished: 0,
    no_result_timeout_cancelled: 0,
}

export async function settleExpiredRaceMatches(matchId: string | null = null) {
    if (!supabaseAdmin) throw new Error("Supabase service role is unavailable")

    const { data, error } = await callRpc(
        supabaseAdmin,
        "expire_playground_race_matches",
        { p_match_id: matchId },
    )
    if (error) throw error

    const counts = data?.[0] ?? EMPTY_LIFECYCLE_COUNTS
    const total =
        counts.waiting_cancelled +
        counts.result_timeout_finished +
        counts.no_result_timeout_cancelled

    if (total > 0) {
        logger.warn("playground race lifecycle auto-settled", {
            event: "playground_race_timeout_settlement",
            metric_value: total,
            match_id: matchId,
            ...counts,
        })
    }

    return counts
}

export async function submitRaceResultBeforeDeadline(
    matchId: string,
    role: RaceRole,
    result: RaceResult,
): Promise<boolean> {
    if (!supabaseAdmin) throw new Error("Supabase service role is unavailable")

    const { data, error } = await callRpc(
        supabaseAdmin,
        "submit_playground_race_result",
        {
            p_match_id: matchId,
            p_role: role,
            p_result: result as Json,
        },
    )
    if (error) throw error
    return data === true
}

export function parseRaceGameKey(value: unknown): RaceGameKey {
    if (!isRaceGameKey(value)) {
        throw new Error("game_key is invalid")
    }
    return value
}

export function parseRaceSettings(
    gameKey: RaceGameKey,
    value: unknown,
): RaceSettings {
    return normalizeRaceSettings(gameKey, value)
}

export function parseRaceResult(
    gameKey: RaceGameKey,
    value: unknown,
    settings: RaceSettings,
): RaceResult {
    return normalizeRaceResult(gameKey, value, settings)
}

export function getRaceRole(match: RaceMatchRow, userId: string): RaceRole | null {
    if (match.host_user_id === userId) return "host"
    if (match.guest_user_id === userId) return "guest"
    return null
}

export function castRaceMatch(row: unknown): RaceMatchRow {
    return row as RaceMatchRow
}

export function raceSettingsEqual(a: RaceSettings, b: RaceSettings): boolean {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key, index) => {
        if (key !== bKeys[index]) return false
        const left = a[key as keyof RaceSettings]
        const right = b[key as keyof RaceSettings]
        if (Array.isArray(left) || Array.isArray(right)) {
            return (
                Array.isArray(left) &&
                Array.isArray(right) &&
                left.length === right.length &&
                left.every((value, valueIndex) => value === right[valueIndex])
            )
        }
        return left === right
    })
}

export function raceResultPatch(
    role: RaceRole,
    result: RaceResult,
): { host_result?: Json; guest_result?: Json } {
    if (role === "host") return { host_result: result as Json }
    return { guest_result: result as Json }
}

export function finishPatch(match: RaceMatchRow) {
    const winner = decideRaceWinner(match.game_key, match.host_result, match.guest_result)
    if (!winner) return null
    return {
        status: "finished",
        winner,
        finish_reason: "completed",
        finished_at: new Date().toISOString(),
    }
}

export async function finishRaceMatchIfComplete(
    match: RaceMatchRow,
): Promise<RaceMatchRow> {
    if (match.status !== "playing") return match
    if (!supabaseAdmin) throw new Error("Supabase service role is unavailable")

    const finish = finishPatch(match)
    if (!finish) return match

    const { count, error } = await supabaseAdmin
        .from("playground_race_matches")
        .update(finish, { count: "exact" })
        .eq("id", match.id)
        .eq("status", "playing")
    if (error) throw error
    if (count && count > 0) return { ...match, ...finish } as RaceMatchRow

    const { data, error: freshError } = await supabaseAdmin
        .from("playground_race_matches")
        .select("*")
        .eq("id", match.id)
        .single()
    if (freshError || !data) throw freshError ?? new Error("Race match not found")
    return castRaceMatch(data)
}

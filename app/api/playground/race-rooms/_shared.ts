import { NextResponse } from "next/server"

import type { Json } from "@/lib/supabase/types"
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
    return aKeys.every((key, index) => key === bKeys[index] && a[key as keyof RaceSettings] === b[key as keyof RaceSettings])
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
        finished_at: new Date().toISOString(),
    }
}

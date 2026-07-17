import { NextResponse } from "next/server"

import { handleApiError, PermissionError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { validateRequiredString, validateUUID, ValidationError } from "@/lib/api/validation"
import {
    addFunctionWarsRepairsToMap,
    availableFunctionWarsCrates,
    buildFunctionWarsOnlineMap,
    isFunctionWarsMapId,
    isFunctionWarsWeaponId,
    normalizeFunctionWarsExpression,
    type FunctionWarsFireResult,
    type FunctionWarsMatchRow,
    type FunctionWarsRole,
} from "@/lib/playground/function-wars-online"
import { simulateFunctionWarsOnlineShot } from "@/lib/playground/function-wars-simulation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"

function validateExpectedShotSeq(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 200) {
        throw new ValidationError("expected_shot_seq is invalid")
    }
    return value as number
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-function-wars-fire",
            limit: 40,
            windowMs: 60_000,
        })
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
        }

        const { id } = await params
        const matchId = validateUUID(id, "match id")
        const body = await request.json().catch(() => null)
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new ValidationError("request body is invalid")
        }
        const payload = body as Record<string, unknown>
        const weapon = validateRequiredString(payload.weapon, "weapon", 16)
        if (!isFunctionWarsWeaponId(weapon)) {
            throw new ValidationError("weapon is invalid")
        }
        const expressionInput = validateRequiredString(payload.expression, "expression", 256)
        const normalizedExpression = normalizeFunctionWarsExpression(expressionInput)
        if (!normalizedExpression.ok) {
            throw new ValidationError(normalizedExpression.error)
        }
        const expectedShotSeq = validateExpectedShotSeq(payload.expected_shot_seq)

        const { data, error } = await supabase
            .from("function_wars_matches")
            .select("*")
            .eq("id", matchId)
            .maybeSingle()
        if (error || !data) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        const match = data as unknown as FunctionWarsMatchRow
        const role: FunctionWarsRole | null = match.host_user_id === user.id
            ? "host"
            : match.guest_user_id === user.id
              ? "guest"
              : null
        if (!role) throw new PermissionError("无权操作该对局")
        if (match.status !== "playing") {
            return NextResponse.json({ error: "对局尚未开始或已经结束" }, { status: 409 })
        }
        if (match.shot_seq !== expectedShotSeq) {
            return NextResponse.json({ error: "对局状态已更新，请重试" }, { status: 409 })
        }
        if (!isFunctionWarsMapId(match.map_id)) {
            throw new Error("Function Wars map id is invalid")
        }

        const baseMap = buildFunctionWarsOnlineMap(match.map_seed, match.map_id)
        const map = addFunctionWarsRepairsToMap(baseMap, match.repairs)
        const simulation = simulateFunctionWarsOnlineShot({
            expression: normalizedExpression.expression,
            role,
            weapon,
            map,
            crates: availableFunctionWarsCrates(match.crates, match.shot_seq),
            craters: match.craters,
            inventory: match.inventory[role],
        })
        if (simulation.error) throw new ValidationError(simulation.error)

        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
            "function_wars_fire_authoritative",
            {
                match_uuid: matchId,
                p_actor_user_id: user.id,
                p_expected_shot_seq: expectedShotSeq,
                p_expression: normalizedExpression.expression,
                p_summary: simulation.summary as unknown as Json,
                p_weapon: weapon,
            },
        )
        if (rpcError) throw rpcError

        const result = (rpcData as FunctionWarsFireResult[] | null)?.[0] ?? null
        if (!result) throw new Error("Function Wars fire RPC returned no result")
        return NextResponse.json(result, { status: result.ok ? 200 : 409 })
    } catch (error) {
        return handleApiError(error)
    }
}

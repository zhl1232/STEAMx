import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";

import { handleApiError, requireAuth } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import { ValidationError } from "@/lib/api/validation";
import {
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    FUNCTION_WARS_DEFAULT_MAP_ID,
    generateRoomCode,
    isFunctionWarsMapId,
    type FunctionWarsMapId,
} from "@/lib/playground/function-wars-online";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const ACTIVE_MATCH_ERROR = "你已有进行中的函数战争对局，请先返回并结束该对局";

function createMapSeed(): number {
    return randomInt(0, 2_147_483_648);
}

function isActiveMatchConstraintError(error: { code?: string; message?: string } | null): boolean {
    return error?.code === "23505" && error.message?.includes("function_wars_user_already_active") === true;
}

function parseMapId(value: unknown): FunctionWarsMapId {
    if (value === undefined || value === null || value === "") {
        return FUNCTION_WARS_DEFAULT_MAP_ID;
    }
    if (!isFunctionWarsMapId(value)) {
        throw new ValidationError("map_id is invalid");
    }
    return value;
}

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const user = await requireAuth(supabase);
        await requireRateLimit(supabase, {
            key: "api-function-wars-room-create",
            limit: 10,
            windowMs: 60_000,
        });

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
        }

        const body = await request.json().catch(() => null);
        const mapId = parseMapId(body?.map_id);

        const { data: activeRooms, error: existingError } = await supabaseAdmin
            .from("function_wars_matches")
            .select("id, code, host_user_id, guest_user_id, status, map_id, map_seed")
            .in("status", ["waiting", "playing"])
            .or(`host_user_id.eq.${user.id},guest_user_id.eq.${user.id}`)
            .order("created_at", { ascending: false })
            .limit(10);
        if (existingError) throw existingError;

        const playingRoom = activeRooms?.find((room) => room.status === "playing");
        if (playingRoom) {
            return NextResponse.json({ error: ACTIVE_MATCH_ERROR }, { status: 409 });
        }

        const existing = activeRooms?.find(
            (room) => room.status === "waiting" && room.host_user_id === user.id,
        );
        const conflictingWaitingRoom = activeRooms?.find(
            (room) => room.status === "waiting" && room.id !== existing?.id,
        );
        if (conflictingWaitingRoom) {
            return NextResponse.json({ error: ACTIVE_MATCH_ERROR }, { status: 409 });
        }

        if (existing && existing.map_id === mapId) {
            return NextResponse.json({
                id: existing.id,
                code: existing.code,
                map_id: existing.map_id,
                map_seed: existing.map_seed,
            });
        }

        if (existing) {
            const mapSeed = createMapSeed();
            const map = buildFunctionWarsOnlineMap(mapSeed, mapId);
            const { error: updateError } = await supabaseAdmin
                .from("function_wars_matches")
                .update({
                    map_id: mapId,
                    map_seed: mapSeed,
                    craters: [] as Json,
                    hp: { host: 100, guest: 100 },
                    inventory: createFunctionWarsInitialInventory() as unknown as Json,
                    crates: map.crates as unknown as Json,
                    repairs: [] as Json,
                    current_turn: "host",
                    last_shot: null,
                    shot_seq: 0,
                    winner: null,
                })
                .eq("id", existing.id)
                .eq("status", "waiting");
            if (updateError) throw updateError;

            return NextResponse.json({
                id: existing.id,
                code: existing.code,
                map_id: mapId,
                map_seed: mapSeed,
            });
        }

        const mapSeed = createMapSeed();
        const map = buildFunctionWarsOnlineMap(mapSeed, mapId);
        let code = generateRoomCode();

        for (let attempt = 0; attempt < 4; attempt++) {
            const { data, error } = await supabaseAdmin
                .from("function_wars_matches")
                .insert({
                    code,
                    host_user_id: user.id,
                    status: "waiting",
                    map_seed: mapSeed,
                    map_id: mapId,
                    craters: [] as Json,
                    hp: { host: 100, guest: 100 },
                    inventory: createFunctionWarsInitialInventory() as unknown as Json,
                    crates: map.crates as unknown as Json,
                    repairs: [] as Json,
                    current_turn: "host",
                })
                .select("id")
                .single();

            if (!error && data) {
                return NextResponse.json({
                    id: data.id,
                    code,
                    map_id: mapId,
                    map_seed: mapSeed,
                });
            }
            if (isActiveMatchConstraintError(error)) {
                return NextResponse.json({ error: ACTIVE_MATCH_ERROR }, { status: 409 });
            }
            if (error?.code !== "23505") throw error;

            const { data: concurrentRoom, error: concurrentError } = await supabase
                .from("function_wars_matches")
                .select("id, code, map_id, map_seed")
                .eq("host_user_id", user.id)
                .eq("status", "waiting")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (concurrentError) throw concurrentError;
            if (concurrentRoom) {
                return NextResponse.json(concurrentRoom);
            }
            code = generateRoomCode();
        }

        return NextResponse.json(
            { error: "创建房间失败，请重试" },
            { status: 500 },
        );
    } catch (error) {
        return handleApiError(error);
    }
}

import { NextResponse } from "next/server";

import { handleApiError, requireAuth } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import { validateRequiredString } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_MATCH_ERROR = "你已有进行中的函数战争对局，请先返回并结束该对局";

function isActiveMatchConstraintError(error: { code?: string; message?: string } | null): boolean {
    return error?.code === "23505" && error.message?.includes("function_wars_user_already_active") === true;
}

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const user = await requireAuth(supabase);
        await requireRateLimit(supabase, {
            key: "api-function-wars-room-join",
            limit: 20,
            windowMs: 60_000,
        });

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
        }

        const body = await request.json().catch(() => null);
        const code = validateRequiredString(body?.code, "code", 6).toUpperCase();

        const { data: match, error } = await supabaseAdmin
            .from("function_wars_matches")
            .select("id, host_user_id, guest_user_id, status, map_id, map_seed")
            .eq("code", code)
            .maybeSingle();

        if (error || !match) {
            return NextResponse.json({ error: "房间不存在" }, { status: 404 });
        }

        if (match.status !== "waiting") {
            if (match.host_user_id === user.id || match.guest_user_id === user.id) {
                return NextResponse.json({
                    id: match.id,
                    code,
                    status: match.status,
                    map_id: match.map_id,
                    map_seed: match.map_seed,
                });
            }
            return NextResponse.json({ error: "房间已开始或已结束" }, { status: 409 });
        }

        if (match.host_user_id === user.id) {
            return NextResponse.json({
                id: match.id,
                code,
                status: match.status,
                map_id: match.map_id,
                map_seed: match.map_seed,
            });
        }

        if (match.guest_user_id && match.guest_user_id !== user.id) {
            return NextResponse.json({ error: "房间已满" }, { status: 409 });
        }

        const { data: activeMatch, error: activeMatchError } = await supabaseAdmin
            .from("function_wars_matches")
            .select("id")
            .in("status", ["waiting", "playing"])
            .or(`host_user_id.eq.${user.id},guest_user_id.eq.${user.id}`)
            .neq("id", match.id)
            .limit(1)
            .maybeSingle();
        if (activeMatchError) throw activeMatchError;
        if (activeMatch) {
            return NextResponse.json({ error: ACTIVE_MATCH_ERROR }, { status: 409 });
        }

        const { count, error: joinError } = await supabaseAdmin
            .from("function_wars_matches")
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
            .is("guest_user_id", null);
        if (isActiveMatchConstraintError(joinError)) {
            return NextResponse.json({ error: ACTIVE_MATCH_ERROR }, { status: 409 });
        }
        if (joinError) throw joinError;

        if (!count) {
            const { data: current, error: currentError } = await supabaseAdmin
                .from("function_wars_matches")
                .select("id, code, guest_user_id, status, map_id, map_seed")
                .eq("id", match.id)
                .single();
            if (currentError) throw currentError;

            if (current?.guest_user_id === user.id) {
                return NextResponse.json(current);
            }

            logger.warn("function wars concurrent join conflict", {
                event: "function_wars_join_conflict",
                metric_value: 1,
                match_id: match.id,
                current_status: current?.status ?? "unknown",
            });
            return NextResponse.json(
                { error: "加入失败，房间已被他人加入或已关闭" },
                { status: 409 },
            );
        }

        return NextResponse.json({
            id: match.id,
            code,
            status: "playing",
            map_id: match.map_id,
            map_seed: match.map_seed,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

import { NextResponse } from "next/server";

import { handleApiError, requireAuth } from "@/lib/api/auth";
import { validateUUID } from "@/lib/api/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient();

    try {
        const user = await requireAuth(supabase);
        const { id } = await params;
        const matchId = validateUUID(id, "match id");

        const { data: match, error } = await supabase
            .from("function_wars_matches")
            .select("id, host_user_id, guest_user_id, status, winner")
            .eq("id", matchId)
            .maybeSingle();
        if (error || !match) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 });
        }

        const role =
            match.host_user_id === user.id
                ? "host"
                : match.guest_user_id === user.id
                  ? "guest"
                  : null;
        if (!role) {
            return NextResponse.json({ error: "无权操作该对局" }, { status: 403 });
        }
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
        }

        let effectiveStatus = match.status;
        let effectiveWinner = match.winner;

        if (effectiveStatus === "waiting") {
            if (role !== "host") {
                return NextResponse.json({ error: "无权取消该房间" }, { status: 403 });
            }
            const { count, error: cancelError } = await supabaseAdmin
                .from("function_wars_matches")
                .update(
                    {
                        status: "cancelled",
                        finished_at: new Date().toISOString(),
                    },
                    { count: "exact" },
                )
                .eq("id", matchId)
                .eq("status", "waiting");
            if (cancelError) throw cancelError;
            if (count) {
                return NextResponse.json({
                    id: matchId,
                    status: "cancelled",
                    winner: null,
                });
            }

            const { data: current, error: currentError } = await supabase
                .from("function_wars_matches")
                .select("status, winner")
                .eq("id", matchId)
                .single();
            if (currentError) throw currentError;
            effectiveStatus = current.status;
            effectiveWinner = current.winner;
        }

        if (effectiveStatus === "playing") {
            const winner = role === "host" ? "guest" : "host";
            const { count, error: finishError } = await supabaseAdmin
                .from("function_wars_matches")
                .update(
                    {
                        status: "finished",
                        winner,
                        finished_at: new Date().toISOString(),
                    },
                    { count: "exact" },
                )
                .eq("id", matchId)
                .eq("status", "playing");
            if (finishError) throw finishError;

            if (!count) {
                const { data: current, error: currentError } = await supabase
                    .from("function_wars_matches")
                    .select("status, winner")
                    .eq("id", matchId)
                    .single();
                if (currentError) throw currentError;
                return NextResponse.json({
                    id: matchId,
                    status: current.status,
                    winner: current.winner,
                });
            }
            return NextResponse.json({ id: matchId, status: "finished", winner });
        }

        return NextResponse.json({
            id: matchId,
            status: effectiveStatus,
            winner: effectiveWinner,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

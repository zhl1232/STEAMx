import { NextResponse } from "next/server";

import { handleApiError, requireAuth } from "@/lib/api/auth";
import { validateUUID } from "@/lib/api/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient();

    try {
        await requireAuth(supabase);
        const { id } = await params;
        const matchId = validateUUID(id, "match id");

        const { data: existing, error: existingError } = await supabase
            .from("function_wars_matches")
            .select("id")
            .eq("id", matchId)
            .maybeSingle();
        if (existingError || !existing) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
        }

        const { error: advanceError } = await supabaseAdmin.rpc(
            "function_wars_advance_expired_turn",
            { match_uuid: matchId },
        );
        if (advanceError) throw advanceError;

        const { data, error } = await supabase
            .from("function_wars_matches")
            .select("*")
            .eq("id", matchId)
            .single();
        if (error || !data) throw error ?? new Error("Function Wars match not found");

        return NextResponse.json(data);
    } catch (error) {
        return handleApiError(error);
    }
}

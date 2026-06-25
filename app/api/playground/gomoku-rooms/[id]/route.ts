import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { validateUUID } from "@/lib/api/validation"
import { createClient } from "@/lib/supabase/server"

// 获取对局全量状态，用于断线重连或页面冷启动恢复。
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()

    try {
        await requireAuth(supabase)
        const { id } = await params
        const matchId = validateUUID(id, "match id")

        const { data, error } = await supabase
            .from("gomoku_matches")
            .select("*")
            .eq("id", matchId)
            .maybeSingle()

        if (error || !data) {
            return NextResponse.json({ error: "对局不存在" }, { status: 404 })
        }

        return NextResponse.json(data)
    } catch (error) {
        return handleApiError(error)
    }
}

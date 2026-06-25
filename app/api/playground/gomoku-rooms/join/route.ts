import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { validateRequiredString } from "@/lib/api/validation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// 按 6 位房间码加入待开始对局。加入即进入 playing，记录 started_at。
// 注：用 supabaseAdmin 更新 guest_user_id，因为 RLS 的 update policy 要求
//   auth.uid() 已是 host/guest，而待加入用户此时不在行内，会被 RLS 拒绝。
//   鉴权由 requireAuth 保证，且先校验房间状态与是否已满。
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const user = await requireAuth(supabase)
        await requireRateLimit(supabase, {
            key: "api-gomoku-room-join",
            limit: 20,
            windowMs: 60_000,
        })

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
        }

        const body = await request.json().catch(() => null)
        const code = validateRequiredString(body?.code, "code", 6).toUpperCase()

        const { data: match, error } = await supabase
            .from("gomoku_matches")
            .select("id, host_user_id, guest_user_id, status")
            .eq("code", code)
            .maybeSingle()

        if (error || !match) {
            return NextResponse.json({ error: "房间不存在" }, { status: 404 })
        }

        if (match.status !== "waiting") {
            // 非 waiting 态：调用者若是该对局 host/guest，放行重入（换设备或丢 localStorage 时凭码恢复）
            if (match.host_user_id === user.id || match.guest_user_id === user.id) {
                return NextResponse.json({
                    id: match.id,
                    code,
                    status: match.status,
                })
            }
            return NextResponse.json({ error: "房间已开始或已结束" }, { status: 409 })
        }

        if (match.host_user_id === user.id) {
            // 房主扫自己的码，直接返回进入对局
            const { data: fresh } = await supabase
                .from("gomoku_matches")
                .select("id, code, status")
                .eq("id", match.id)
                .single()
            return NextResponse.json(fresh)
        }

        if (match.guest_user_id && match.guest_user_id !== user.id) {
            return NextResponse.json({ error: "房间已满" }, { status: 409 })
        }

        // 用 admin 客户端更新，绕过 RLS（待加入用户尚不是该行 host/guest）。
        // 用 .eq("status","waiting") 保证并发加入时只有第一个成功。
        const { count, error: joinError } = await supabaseAdmin
            .from("gomoku_matches")
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
            .is("guest_user_id", null)

        if (joinError) throw joinError

        // 并发或状态已变：UPDATE 影响 0 行
        if (!count || count === 0) {
            return NextResponse.json(
                { error: "加入失败，房间已被他人加入或已关闭" },
                { status: 409 },
            )
        }

        return NextResponse.json({ id: match.id, code, status: "playing" })
    } catch (error) {
        return handleApiError(error)
    }
}

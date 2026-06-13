import { NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { syncPlaygroundBadges } from "@/lib/gamification/playground-badges"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: "api-playground-badge-sync", limit: 30, windowMs: 60_000 })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 })
    }

    const result = await syncPlaygroundBadges(user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireAuth } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { FEATURED_BADGE_LIMIT } from "@/lib/gamification/honorifics";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  try {
    const user = await requireAuth(supabase);
    await requireRateLimit(supabase, {
      key: "equipped-honor-update",
      limit: 30,
      windowMs: 60_000,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "参数格式错误" }, { status: 400 });
    }

    const { equipped_title, featured_badge_ids } = body as {
      equipped_title?: string | null;
      featured_badge_ids?: string[] | null;
    };

    const updatePayload: Database["public"]["Tables"]["profiles"]["Update"] = {};

    if (equipped_title !== undefined) {
      if (equipped_title === null || equipped_title === "none" || typeof equipped_title === "string") {
        updatePayload.equipped_title = equipped_title === null ? null : equipped_title.trim();
      } else {
        return NextResponse.json({ error: "称号参数格式错误" }, { status: 400 });
      }
    }

    if (featured_badge_ids !== undefined) {
      if (featured_badge_ids === null) {
        updatePayload.featured_badge_ids = null;
      } else if (Array.isArray(featured_badge_ids)) {
        const normalizedIds = Array.from(
          new Set(
            featured_badge_ids
              .filter((id): id is string => typeof id === "string")
              .map((id) => id.trim())
              .filter((id) => id !== ""),
          ),
        );
        if (normalizedIds.length > FEATURED_BADGE_LIMIT) {
          return NextResponse.json({ error: `精选徽章最多展示 ${FEATURED_BADGE_LIMIT} 枚` }, { status: 400 });
        }
        updatePayload.featured_badge_ids = normalizedIds;
      } else {
        return NextResponse.json({ error: "精选徽章参数格式错误" }, { status: 400 });
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "没有提供需要更新的字段" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      equipped_title: updatePayload.equipped_title,
      featured_badge_ids: updatePayload.featured_badge_ids,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

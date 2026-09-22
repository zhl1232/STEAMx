import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole, handleApiError } from "@/lib/api/auth";
import { communicationsDb } from "@/lib/communications/service";
import { announcementId } from "@/lib/communications/validation";
export async function POST(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(await createClient(), ["admin"]);
    const { data, error } = await communicationsDb().rpc(
      "retry_platform_announcement_service",
      { p_announcement_id: announcementId((await context.params).id) },
    );
    if (error) throw error;
    return data
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          { error: "只能重试已发布公告的投递" },
          { status: 409 },
        );
  } catch (error) {
    return handleApiError(error);
  }
}

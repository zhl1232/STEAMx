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
      "publish_platform_announcement_service",
      { p_announcement_id: announcementId((await context.params).id) },
    );
    if (error?.code === "P0001")
      return NextResponse.json(
        { error: "公告不存在、已撤下或已过期，请刷新检查" },
        { status: 409 },
      );
    if (error) throw error;
    return NextResponse.json({
      announcement: Array.isArray(data) ? data[0] : data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

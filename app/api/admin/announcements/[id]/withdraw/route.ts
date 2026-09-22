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
    const { data, error } = await communicationsDb()
      .from("platform_announcements")
      .update({ status: "withdrawn" })
      .eq("id", announcementId((await context.params).id))
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data
      ? NextResponse.json({ announcement: data })
      : NextResponse.json({ error: "公告不存在" }, { status: 404 });
  } catch (error) {
    return handleApiError(error);
  }
}

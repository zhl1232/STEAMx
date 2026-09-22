import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole, handleApiError } from "@/lib/api/auth";
import {
  getAnnouncement,
  communicationsDb,
} from "@/lib/communications/service";
import {
  announcementPatchInput,
  announcementId,
  parseCommunicationInput,
} from "@/lib/communications/validation";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireRole(await createClient(), ["admin"]);
    const id = announcementId((await context.params).id);
    const current = await getAnnouncement(id, true);
    if (!current)
      return NextResponse.json({ error: "公告不存在" }, { status: 404 });
    if (current.status === "withdrawn")
      return NextResponse.json(
        { error: "已撤下的公告无法修改" },
        { status: 409 },
      );
    const patch = parseCommunicationInput(
      announcementPatchInput,
      await request.json(),
    );
    const next = { ...current, ...patch };
    if (Boolean(next.action_label) !== Boolean(next.action_href))
      return NextResponse.json(
        { error: "按钮名称与链接需要一起填写" },
        { status: 400 },
      );
    const { data, error } = await communicationsDb()
      .from("platform_announcements")
      .update(patch)
      .eq("id", id)
      .neq("status", "withdrawn")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { error: "公告状态已改变，请刷新" },
        { status: 409 },
      );
    return NextResponse.json({ announcement: data });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function GET(_: NextRequest, context: Context) {
  try {
    await requireRole(await createClient(), ["admin"]);
    const announcement = await getAnnouncement(
      announcementId((await context.params).id),
      true,
    );
    return announcement
      ? NextResponse.json({ announcement })
      : NextResponse.json({ error: "公告不存在" }, { status: 404 });
  } catch (error) {
    return handleApiError(error);
  }
}

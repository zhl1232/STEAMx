import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole, handleApiError } from "@/lib/api/auth";
import {
  listAnnouncements,
  communicationsDb,
} from "@/lib/communications/service";
import {
  announcementInput,
  parseCommunicationInput,
} from "@/lib/communications/validation";
export async function GET() {
  try {
    await requireRole(await createClient(), ["admin"]);
    const [announcements, stats] = await Promise.all([
      listAnnouncements({ includeDrafts: true }),
      communicationsDb().rpc("platform_announcement_stats_service", {}),
    ]);
    if (stats.error) throw stats.error;
    const byId = new Map(
      (stats.data ?? []).map((row) => [row.announcement_id, row]),
    );
    return NextResponse.json({
      announcements: announcements.map((item) => ({
        ...item,
        delivery: byId.get(item.id),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await requireRole(await createClient(), ["admin"]);
    const input = parseCommunicationInput(
      announcementInput,
      await request.json(),
    );
    if (Boolean(input.action_label) !== Boolean(input.action_href))
      return NextResponse.json(
        { error: "按钮名称与链接需要一起填写" },
        { status: 400 },
      );
    const { data, error } = await communicationsDb()
      .from("platform_announcements")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ announcement: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

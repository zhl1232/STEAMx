import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listAnnouncements,
  communicationsDb,
} from "@/lib/communications/service";
import { handleApiError } from "@/lib/api/auth";
export async function GET() {
  try {
    const announcements = await listAnnouncements({ activeOnly: true });
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user || !announcements.length)
      return NextResponse.json(
        { announcements },
        { headers: { "Cache-Control": "no-store" } },
      );
    const { data, error } = await communicationsDb()
      .from("communication_ledger")
      .select("announcement_id,banner_dismissed_at,popup_claimed_at")
      .eq("user_id", user.id)
      .in(
        "announcement_id",
        announcements.map((item) => item.id),
      );
    if (error) throw error;
    const states = new Map(
      (data ?? []).map((row) => [row.announcement_id, row]),
    );
    return NextResponse.json(
      {
        announcements: announcements.map((item) => ({
          ...item,
          banner_dismissed: Boolean(states.get(item.id)?.banner_dismissed_at),
          popup_shown: Boolean(states.get(item.id)?.popup_claimed_at),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

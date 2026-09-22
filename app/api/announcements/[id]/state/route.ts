import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, handleApiError } from "@/lib/api/auth";
import {
  getAnnouncement,
  recordAnnouncementState,
} from "@/lib/communications/service";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(await createClient());
    const id = Number((await context.params).id);
    const body = await request.json();
    const action = body?.action;
    if (
      !Number.isInteger(id) ||
      !["dismiss_banner", "claim_popup", "read"].includes(action)
    )
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    const announcement = await getAnnouncement(id);
    if (!announcement || announcement.status !== "published")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (action === "claim_popup" && announcement.level !== "urgent")
      return NextResponse.json({ error: "Popup unavailable" }, { status: 400 });
    return NextResponse.json(
      await recordAnnouncementState(user.id, id, action),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

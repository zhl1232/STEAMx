import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/auth";
import { getAnnouncement } from "@/lib/communications/service";
import { announcementId } from "@/lib/communications/validation";
export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const announcement = await getAnnouncement(
      announcementId((await context.params).id),
    );
    if (!announcement)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { announcement },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

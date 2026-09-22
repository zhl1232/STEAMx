import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/auth";
import { listAnnouncements } from "@/lib/communications/service";
export async function GET() {
  try {
    return NextResponse.json(
      { announcements: await listAnnouncements() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { deliverAnnouncementBatch } from "@/lib/communications/service";
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await deliverAnnouncementBatch(Math.min(Number(body?.limit) || 50, 200)),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Worker failed" },
      { status: 500 },
    );
  }
}

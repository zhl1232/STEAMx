import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, handleApiError } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import {
  createWelcomeForUser,
  getWelcomeSettings,
} from "@/lib/communications/service";
import { DEFAULT_WELCOME_SETTINGS } from "@/lib/communications/types";
export async function GET() {
  try {
    return NextResponse.json(
      { settings: await getWelcomeSettings() },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json(
      { settings: DEFAULT_WELCOME_SETTINGS },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function POST() {
  const db = await createClient();
  try {
    const user = await requireAuth(db);
    await requireRateLimit(db, {
      key: "welcome-initialize",
      limit: 10,
      windowMs: 60_000,
    });
    return NextResponse.json(await createWelcomeForUser(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

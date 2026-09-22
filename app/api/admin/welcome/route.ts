import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole, handleApiError } from "@/lib/api/auth";
import {
  communicationsDb,
  getWelcomeSettings,
} from "@/lib/communications/service";
import {
  parseCommunicationInput,
  welcomeInput,
} from "@/lib/communications/validation";
export async function GET() {
  try {
    await requireRole(await createClient(), ["admin"]);
    return NextResponse.json({ settings: await getWelcomeSettings() });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    await requireRole(await createClient(), ["admin"]);
    const patch = parseCommunicationInput(welcomeInput, await request.json());
    const { data, error } = await communicationsDb()
      .from("platform_welcome_settings")
      .update(patch)
      .eq("id", true)
      .select("enabled,title,body,contact_href")
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (error) {
    return handleApiError(error);
  }
}

import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Announcement,
  AnnouncementStateAction,
  WelcomeSettings,
} from "./types";
import { DEFAULT_WELCOME_SETTINGS } from "./types";

export function communicationsDb() {
  if (!supabaseAdmin)
    throw new Error("Communications service is not configured");
  return supabaseAdmin;
}
export function publicAnnouncement(item: Announcement): Announcement {
  return item.status === "withdrawn"
    ? {
        ...item,
        title: "公告已撤下",
        summary: "",
        body: "",
        action_label: null,
        action_href: null,
      }
    : item;
}
export async function listAnnouncements(
  options: { includeDrafts?: boolean; activeOnly?: boolean } = {},
) {
  let query = communicationsDb()
    .from("platform_announcements")
    .select("*")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });
  if (!options.includeDrafts)
    query = query.in("status", ["published", "withdrawn"]);
  if (options.activeOnly)
    query = query
      .eq("status", "published")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .in("level", ["important", "urgent"]);
  const { data, error } = await query;
  if (error) throw error;
  return options.includeDrafts
    ? (data ?? [])
    : (data ?? []).map(publicAnnouncement);
}
export async function getAnnouncement(id: number, includeDrafts = false) {
  const { data, error } = await communicationsDb()
    .from("platform_announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!includeDrafts && data.status === "draft")) return null;
  return includeDrafts ? data : publicAnnouncement(data);
}
export async function getWelcomeSettings(): Promise<WelcomeSettings> {
  const { data, error } = await communicationsDb()
    .from("platform_welcome_settings")
    .select("enabled,title,body,contact_href")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_WELCOME_SETTINGS;
}
export async function recordAnnouncementState(
  userId: string,
  id: number,
  action: AnnouncementStateAction,
) {
  const db = communicationsDb();
  if (action === "claim_popup") {
    const { data, error } = await db.rpc("claim_announcement_popup_service", {
      p_user_id: userId,
      p_announcement_id: id,
    });
    if (error) throw error;
    return { claimed: data === true };
  }
  if (action === "read") {
    const { error } = await db.rpc("mark_communication_read_service", {
      p_user_id: userId,
      p_event_key: `announcement:${id}`,
    });
    if (error) throw error;
  } else {
    const { error } = await db
      .from("communication_ledger")
      .upsert(
        {
          user_id: userId,
          event_key: `announcement:${id}`,
          kind: "announcement",
          announcement_id: id,
          banner_dismissed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_key" },
      );
    if (error) throw error;
  }
  return { claimed: false };
}
export async function createWelcomeForUser(userId: string) {
  const { data, error } = await communicationsDb().rpc(
    "create_welcome_service",
    { p_user_id: userId },
  );
  if (error) throw error;
  return { created: data === true };
}
export async function deliverAnnouncementBatch(limit = 50) {
  const db = communicationsDb();
  const { data: jobs, error } = await db
    .from("communication_worker_state")
    .select("name")
    .neq("status", "done")
    .lt("attempts", 5)
    .lte("next_run_at", new Date().toISOString())
    .order("updated_at")
    .limit(10);
  if (error) throw error;
  let delivered = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const id = Number(job.name.replace("announcement:", ""));
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const { data, error: batchError } = await db.rpc(
      "run_announcement_batch_service",
      { p_announcement_id: id, p_limit: limit },
    );
    if (batchError) throw batchError;
    const batch = data as {
      delivered?: number;
      error?: string;
      stopped?: boolean;
    };
    delivered += batch?.delivered ?? 0;
    if (batch?.error) failed++;
    if (batch?.stopped) {
      const result = await db
        .from("communication_worker_state")
        .update({ status: "done" })
        .eq("name", job.name);
      if (result.error) throw result.error;
    }
  }
  return { delivered, failed };
}

/**
 * Backfill user_badges with new dynamic badge IDs based on current user stats.
 *
 * Prerequisites:
 * 1. Apply migration 20260211100001_dynamic_badges_insert.sql (new badges exist).
 * 2. Set env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: npx tsx scripts/backfill-badges.ts
 *
 * After running, apply 20260211100002_dynamic_badges_remove_old.sql to drop old badge rows.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";
import { BADGES } from "../lib/gamification/badges";
import type { UserStats } from "../lib/gamification/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, xp");
  if (profilesError) {
    console.error("Failed to fetch profiles:", profilesError);
    process.exit(1);
  }
  if (!profiles?.length) {
    process.stdout.write("No profiles found.\n");
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const { data: raw, error } = await supabase.rpc("get_user_stats_summary", {
      target_user_id: profile.id,
    } as never);
    if (error) {
      console.warn(`get_user_stats_summary failed for ${profile.id}:`, error.message);
      continue;
    }
    const xp = profile.xp ?? 0;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const stats: UserStats = {
      projectsPublished: (raw as Record<string, number>)?.projectsPublished ?? 0,
      projectsLiked: (raw as Record<string, number>)?.projectsLiked ?? 0,
      projectsCompleted: (raw as Record<string, number>)?.projectsCompleted ?? 0,
      commentsCount: (raw as Record<string, number>)?.commentsCount ?? 0,
      scienceCompleted: (raw as Record<string, number>)?.scienceCompleted ?? 0,
      techCompleted: (raw as Record<string, number>)?.techCompleted ?? 0,
      engineeringCompleted: (raw as Record<string, number>)?.engineeringCompleted ?? 0,
      artCompleted: (raw as Record<string, number>)?.artCompleted ?? 0,
      mathCompleted: (raw as Record<string, number>)?.mathCompleted ?? 0,
      likesGiven: (raw as Record<string, number>)?.likesGiven ?? 0,
      likesReceived: (raw as Record<string, number>)?.likesReceived ?? 0,
      collectionsCount: (raw as Record<string, number>)?.collectionsCount ?? 0,
      challengesJoined: (raw as Record<string, number>)?.challengesJoined ?? 0,
      level,
      loginDays: (raw as Record<string, number>)?.loginDays ?? 0,
      consecutiveDays: (raw as Record<string, number>)?.consecutiveDays ?? 0,
      discussionsCreated: (raw as Record<string, number>)?.discussionsCreated ?? 0,
      repliesCount: (raw as Record<string, number>)?.repliesCount ?? 0,
    };

    for (const badge of BADGES) {
      try {
        if (!badge.condition(stats)) continue;
      } catch {
        continue;
      }
      const { error: insertErr } = await supabase.from("user_badges").insert(
        {
          user_id: profile.id,
          badge_id: badge.id,
          unlocked_at: new Date().toISOString(),
        } as never
      );
      if (insertErr) {
        if (insertErr.code === "23505") continue; // unique violation, already has badge
        if (insertErr.code === "23503") continue; // FK violation, skip
        skipped++;
      } else {
        inserted++;
      }
    }
  }

  process.stdout.write(`Backfill done. Inserted/updated: ${inserted}, skipped: ${skipped}\n`);
}

main();

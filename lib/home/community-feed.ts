import { unstable_cache } from "next/cache";

import { getBirdObservationRecentObservations } from "@/lib/api/nature-observation-homepage";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { formatRelativeTime } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { type ObservationEvent } from "@/lib/mappers/types";
import { isPlaywrightSmoke } from "@/lib/testing/playwright-smoke";
import { createPublicClient } from "@/lib/supabase/server";

export type HomeCommunityFeedKind = "observation" | "project_new" | "project_like";

export interface HomeCommunityFeedItem {
  key: string;
  kind: HomeCommunityFeedKind;
  href: string;
  actorName: string;
  action: string;
  title: string;
  timeLabel: string;
}

type Candidate = { sortAt: string; item: HomeCommunityFeedItem };

function unwrapProfile(profiles: unknown): { display_name?: string | null; username?: string | null } | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return (profiles[0] as { display_name?: string | null; username?: string | null }) ?? null;
  return profiles as { display_name?: string | null; username?: string | null };
}

function displayNameFromProfile(profile: { display_name?: string | null; username?: string | null } | null): string {
  const fromDisplay = profile?.display_name?.trim();
  if (fromDisplay) return fromDisplay;
  const fromUser = profile?.username?.trim();
  if (fromUser) return fromUser;
  return "用户";
}

function observationFeedTitle(event: ObservationEvent): string {
  const firstSpecies = event.species?.[0];
  if (firstSpecies?.commonName?.trim()) {
    return `${firstSpecies.commonName.trim()} · 观察记录`;
  }
  if (event.locationName?.trim()) {
    return event.locationName.trim();
  }
  const note = event.notes?.trim();
  if (note) {
    return note.length > 48 ? `${note.slice(0, 48)}…` : note;
  }
  return "自然观察记录";
}

function pickTopCandidates(candidates: Candidate[], limit: number): HomeCommunityFeedItem[] {
  const sorted = [...candidates].sort(
    (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
  );
  const picked: HomeCommunityFeedItem[] = [];
  const seen = new Set<string>();

  for (const { item } of sorted) {
    const dedupeKey = `${item.kind}:${item.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    picked.push(item);
    if (picked.length >= limit) break;
  }

  return picked;
}

async function buildHomepageCommunityFeed(enforceReviewed: boolean): Promise<HomeCommunityFeedItem[]> {
  if (isPlaywrightSmoke()) {
    return [];
  }

  const supabase = createPublicClient();
  const candidates: Candidate[] = [];

  let projectQuery = supabase
      .from("projects")
      .select("id, title, created_at, profiles:author_id (display_name, username)")
      .eq("status", "approved")
      .eq("moderation_state", "approved")
      .order("created_at", { ascending: false })
      .limit(8);
  if (enforceReviewed) {
    projectQuery = projectQuery.eq("classification_status", "reviewed");
  }

  const [projRes, likeRes, observations] = await Promise.all([
    projectQuery,
    supabase.from("likes").select("user_id, project_id, created_at").order("created_at", { ascending: false }).limit(14),
    getBirdObservationRecentObservations(8).catch((error) => {
      logger.error("homepage community feed: observations failed", { error });
      return [] as ObservationEvent[];
    }),
  ]);

  if (projRes.error) {
    logger.error("homepage community feed: projects query failed", { error: projRes.error });
  } else {
    for (const row of projRes.data || []) {
      const profile = unwrapProfile((row as { profiles?: unknown }).profiles);
      candidates.push({
        sortAt: row.created_at,
        item: {
          key: `project-new-${row.id}`,
          kind: "project_new",
          href: `/project/${row.id}`,
          actorName: displayNameFromProfile(profile),
          action: "发布了新项目",
          title: row.title,
          timeLabel: formatRelativeTime(row.created_at),
        },
      });
    }
  }

  const likeRows = likeRes.data || [];
  if (likeRes.error) {
    logger.error("homepage community feed: likes query failed", { error: likeRes.error });
  } else if (likeRows.length > 0) {
    const projectIds = [...new Set(likeRows.map((row) => row.project_id))];
    const userIds = [...new Set(likeRows.map((row) => row.user_id))];

    let likeProjectQuery = supabase
        .from("projects")
        .select("id, title, status, moderation_state")
        .eq("status", "approved")
        .eq("moderation_state", "approved")
        .in("id", projectIds);
    if (enforceReviewed) {
      likeProjectQuery = likeProjectQuery.eq("classification_status", "reviewed");
    }
    const [{ data: likeProjects, error: lpErr }, { data: likeProfiles, error: lprofErr }] = await Promise.all([
      likeProjectQuery,
      supabase.from("profiles").select("id, display_name, username").in("id", userIds),
    ]);

    if (lpErr) logger.error("homepage community feed: like projects hydrate failed", { error: lpErr });
    if (lprofErr) logger.error("homepage community feed: like profiles hydrate failed", { error: lprofErr });

    const projectById = new Map(
      ((likeProjects || []) as { id: number; title: string; status: string }[]).map((p) => [p.id, p]),
    );
    const profileById = new Map(
      ((likeProfiles || []) as { id: string; display_name?: string | null; username?: string | null }[]).map((p) => [
        p.id,
        p,
      ]),
    );

    for (const row of likeRows) {
      const project = projectById.get(row.project_id);
      if (!project || project.status !== "approved") continue;

      const profile = profileById.get(row.user_id) ?? null;
      candidates.push({
        sortAt: row.created_at,
        item: {
          key: `project-like-${row.user_id}-${row.project_id}-${row.created_at}`,
          kind: "project_like",
          href: `/project/${row.project_id}`,
          actorName: displayNameFromProfile(profile),
          action: "点赞了项目",
          title: project.title,
          timeLabel: formatRelativeTime(row.created_at),
        },
      });
    }
  }

  for (const event of observations) {
    const name = event.authorDisplayName?.trim() || "自然观察者";
    candidates.push({
      sortAt: event.createdAt,
      item: {
        key: `observation-${event.id}`,
        kind: "observation",
        href: `/nature/observations/${event.id}`,
        actorName: name,
        action: "分享了观察记录",
        title: observationFeedTitle(event),
        timeLabel: formatRelativeTime(event.createdAt),
      },
    });
  }

  return pickTopCandidates(candidates, 3);
}

const getHomepageCommunityFeedCached = unstable_cache(
  async (enforceReviewed: boolean) => buildHomepageCommunityFeed(enforceReviewed),
  ["homepage-community-feed-v4-observation-created-at"],
  { revalidate: 120 },
);

export async function getHomepageCommunityFeed(): Promise<HomeCommunityFeedItem[]> {
  try {
    const settings = await getContentClassificationSettings();
    return await getHomepageCommunityFeedCached(settings.enforcementEnabled);
  } catch (error) {
    logger.error("getHomepageCommunityFeed failed", { error });
    return [];
  }
}

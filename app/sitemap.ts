import type { MetadataRoute } from "next";

import { hasLdrawModelFile } from "@/lib/courses/ldraw-bom-source";
import { logger } from "@/lib/logger";
import { PLAYGROUND_METADATA_PATHS } from "@/lib/seo/playground-metadata";
import { fetchAllSitemapRows } from "@/lib/seo/sitemap-pagination";
import { buildAbsoluteUrl } from "@/lib/seo/site";
import { createPublicClient } from "@/lib/supabase/server";

// Keep the discovery file stable for crawlers and CDNs while still refreshing
// newly published public content without requiring a full deployment.
export const revalidate = 3600;

interface TimestampedIdRow {
  id: number;
  updated_at: string | null;
}

interface SpeciesRow {
  slug: string;
  updated_at: string | null;
}

interface WorkRow {
  id: number;
  completed_at: string | null;
}

interface ChallengeRow {
  id: number;
  created_at: string | null;
}

interface LessonRow extends TimestampedIdRow {
  course_id: number;
  ldraw_model_url?: string | null;
}

interface SitemapContentRows {
  projects: TimestampedIdRow[];
  species: SpeciesRow[];
  observations: TimestampedIdRow[];
  courses: TimestampedIdRow[];
  lessons: Array<LessonRow & { hasModelFile: boolean }>;
  works: WorkRow[];
  resources: TimestampedIdRow[];
  challenges: ChallengeRow[];
}

interface StaticSitemapRoute {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}

export const STATIC_SITEMAP_ROUTES: StaticSitemapRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/explore", changeFrequency: "daily", priority: 0.9 },
  { path: "/create", changeFrequency: "daily", priority: 0.8 },
  { path: "/courses", changeFrequency: "weekly", priority: 0.9 },
  { path: "/nature", changeFrequency: "daily", priority: 0.8 },
  { path: "/nature/birds", changeFrequency: "weekly", priority: 0.8 },
  { path: "/nature/insects", changeFrequency: "weekly", priority: 0.8 },
  { path: "/nature/plants", changeFrequency: "weekly", priority: 0.8 },
  { path: "/nature/species", changeFrequency: "daily", priority: 0.8 },
  { path: "/nature/observations", changeFrequency: "daily", priority: 0.8 },
  { path: "/nature/map", changeFrequency: "daily", priority: 0.7 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/playground", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
  ...PLAYGROUND_METADATA_PATHS.map((path) => ({
    path,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  })),
];

function toLastModified(value: string | null | undefined) {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function sitemapEntry(
  path: string,
  options: Omit<MetadataRoute.Sitemap[number], "url">,
): MetadataRoute.Sitemap[number] {
  return { url: buildAbsoluteUrl(path), ...options };
}

export function buildSitemapEntries(content?: SitemapContentRows): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map(({ path, ...options }) =>
    sitemapEntry(path, options),
  );

  if (!content) return routes;

  content.species.forEach((species) => {
    routes.push(sitemapEntry(`/nature/species/${species.slug}`, {
      lastModified: toLastModified(species.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  });

  content.observations.forEach((observation) => {
    routes.push(sitemapEntry(`/nature/observations/${observation.id}`, {
      lastModified: toLastModified(observation.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  });

  content.projects.forEach((project) => {
    routes.push(sitemapEntry(`/project/${project.id}`, {
      lastModified: toLastModified(project.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  });

  content.courses.forEach((course) => {
    routes.push(sitemapEntry(`/courses/${course.id}`, {
      lastModified: toLastModified(course.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  });

  content.lessons.forEach((lesson) => {
    const lastModified = toLastModified(lesson.updated_at);
    routes.push(sitemapEntry(`/courses/${lesson.course_id}/lessons/${lesson.id}`, {
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
    if (lesson.hasModelFile) {
      routes.push(sitemapEntry(`/courses/${lesson.course_id}/lessons/${lesson.id}/parts`, {
        lastModified,
        changeFrequency: "monthly",
        priority: 0.5,
      }));
    }
  });

  content.works.forEach((work) => {
    routes.push(sitemapEntry(`/works/${work.id}`, {
      lastModified: toLastModified(work.completed_at),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  });

  content.resources.forEach((resource) => {
    routes.push(sitemapEntry(`/resources/${resource.id}`, {
      lastModified: toLastModified(resource.updated_at),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  });

  content.challenges.forEach((challenge) => {
    routes.push(sitemapEntry(`/pbl/${challenge.id}`, {
      lastModified: toLastModified(challenge.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  });

  return routes;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createPublicClient();

    const [projects, species, observations, courses, works, resources, challenges] = await Promise.all([
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("projects")
        .select("id, updated_at")
        .eq("status", "approved")
        .eq("moderation_state", "approved")),
      fetchAllSitemapRows<SpeciesRow>(() => supabase
        .from("species")
        .select("slug, updated_at")
        .eq("is_active", true), { orderColumn: "id" }),
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("observation_events")
        .select("id, updated_at")
        .eq("status", "approved")
        .eq("is_public", true)
        .eq("moderation_state", "approved")),
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("courses")
        .select("id, updated_at")
        .eq("status", "approved")),
      fetchAllSitemapRows<WorkRow>(() => supabase
        .from("completed_projects")
        .select("id, completed_at")
        .eq("record_kind", "final")
        .eq("status", "approved")
        .eq("is_public", true)
        .eq("moderation_state", "approved")),
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("learning_resources")
        .select("id, updated_at")
        .eq("status", "published")),
      fetchAllSitemapRows<ChallengeRow>(() => supabase
        .from("challenges")
        .select("id, created_at")
        .in("status", ["active", "ended"])),
    ]);

    const courseIds = courses.map((course) => course.id);
    const lessonRows = courseIds.length > 0
      ? await fetchAllSitemapRows<LessonRow>(() => supabase
          .from("course_lessons")
          .select("id, course_id, updated_at, ldraw_model_url:content->building3d->>ldrawModelUrl")
          .in("course_id", courseIds))
      : [];
    const lessons = await Promise.all(lessonRows.map(async (lesson) => ({
      ...lesson,
      hasModelFile: Boolean(lesson.ldraw_model_url)
        && await hasLdrawModelFile(lesson.ldraw_model_url),
    })));

    return buildSitemapEntries({
      projects,
      species,
      observations,
      courses,
      lessons,
      works,
      resources,
      challenges,
    });
  } catch (error) {
    logger.error("Error generating sitemap", { error });
    return buildSitemapEntries();
  }
}

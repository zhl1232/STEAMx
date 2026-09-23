import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";

import { hasLdrawModelFile } from "@/lib/courses/ldraw-bom-source";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { logger } from "@/lib/logger";
import { LEARNING_TOPICS } from "@/lib/seo/learning-topics";
import { PLAYGROUND_METADATA_PATHS } from "@/lib/seo/playground-metadata";
import { fetchAllSitemapRows } from "@/lib/seo/sitemap-pagination";
import { buildAbsoluteUrl } from "@/lib/seo/site";
import { createPublicClient } from "@/lib/supabase/server";
import {
  isVisibleSpeciesTopicKey,
  visibleSpeciesTopicKeys,
} from "@/lib/utils/nature-topic-classification";

// Generate at request time, so builds do not require a live content database.
// The complete successful result is cached separately below.
export const revalidate = 0;

interface TimestampedIdRow {
  id: number;
  updated_at: string | null;
}

interface SpeciesRow {
  slug: string;
  nature_topic: string | null;
  updated_at: string | null;
}

interface WorkRow {
  id: number;
  completed_at: string | null;
  reviewed_at?: string | null;
  project_id?: number | null;
  course_lesson_id?: number | null;
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
  { path: "/courses", changeFrequency: "weekly", priority: 0.9 },
  ...LEARNING_TOPICS.map(({ slug }) => ({
    path: `/learn/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  })),
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

function latestLastModified(...values: Array<string | null | undefined>) {
  const dates = values.map(toLastModified).filter((date): date is Date => Boolean(date));
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : undefined;
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

  content.species
    .filter((species) => isVisibleSpeciesTopicKey(species.nature_topic))
    .forEach((species) => {
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
      lastModified: latestLastModified(work.completed_at, work.reviewed_at),
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

async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createPublicClient();
    const classificationSettings = await getContentClassificationSettings();

    const createProjectsQuery = () => {
      let query = supabase
        .from("projects")
        .select("id, updated_at")
        .eq("status", "approved")
        .eq("moderation_state", "approved");
      if (classificationSettings.enforcementEnabled) {
        query = query.eq("classification_status", "reviewed");
      }
      return query;
    };
    const createCoursesQuery = () => {
      let query = supabase
        .from("courses")
        .select("id, updated_at")
        .eq("status", "approved");
      query = query.eq("is_listed", true);
      if (classificationSettings.enforcementEnabled) {
        query = query.eq("classification_status", "reviewed");
      }
      return query;
    };
    const createChallengesQuery = () => {
      let query = supabase
        .from("challenges")
        .select("id, created_at")
        .in("status", ["active", "ended"]);
      if (classificationSettings.enforcementEnabled) {
        query = query.eq("classification_status", "reviewed");
      }
      return query;
    };

    const [projects, species, observations, courses, works, resources, challenges] = await Promise.all([
      fetchAllSitemapRows<TimestampedIdRow>(createProjectsQuery),
      fetchAllSitemapRows<SpeciesRow>(() => supabase
        .from("species")
        .select("slug, nature_topic, updated_at")
        .eq("is_active", true)
        .in("nature_topic", [...visibleSpeciesTopicKeys]), { orderColumn: "id" }),
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("observation_events")
        .select("id, updated_at")
        .eq("status", "approved")
        .eq("is_public", true)
        .eq("moderation_state", "approved")),
      fetchAllSitemapRows<TimestampedIdRow>(createCoursesQuery),
      fetchAllSitemapRows<WorkRow>(() => supabase
        .from("completed_projects")
        .select("id, completed_at, reviewed_at, project_id, course_lesson_id")
        .eq("record_kind", "final")
        .eq("status", "approved")
        .eq("is_public", true)
        .eq("moderation_state", "approved")),
      fetchAllSitemapRows<TimestampedIdRow>(() => supabase
        .from("learning_resources")
        .select("id, updated_at")
        .eq("status", "published")),
      fetchAllSitemapRows<ChallengeRow>(createChallengesQuery),
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

    const visibleWorks = classificationSettings.enforcementEnabled
      ? (() => {
          const visibleProjectIds = new Set(projects.map((project) => project.id));
          const visibleLessonIds = new Set(lessonRows.map((lesson) => lesson.id));
          return works.filter((work) => {
            if (work.project_id != null) return visibleProjectIds.has(work.project_id);
            if (work.course_lesson_id != null) return visibleLessonIds.has(work.course_lesson_id);
            return true;
          });
        })()
      : works;

    return buildSitemapEntries({
      projects,
      species,
      observations,
      courses,
      lessons,
      works: visibleWorks,
      resources,
      challenges,
    });
  } catch (error) {
    logger.error("Error generating sitemap", { error });
    // Do not replace the last complete data-cache entry with a partial result.
    // A cold cache must fail explicitly rather than publish an incomplete 200.
    throw error;
  }
}

// Catalog visibility changes should reach crawlers within minutes of publication.
// Bump the key when changing the policy so a deployment drops the old hourly snapshot.
const getCachedSitemap = unstable_cache(generateSitemap, ["public-sitemap-v4-course-visibility"], { revalidate: 300 });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap();
}

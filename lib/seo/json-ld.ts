import { SITE_DESCRIPTION, SITE_NAME, buildAbsoluteUrl, getSiteUrl } from "@/lib/seo/site";

export function toAbsoluteMediaUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return buildAbsoluteUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

export function buildWebsiteJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: buildAbsoluteUrl("/logo.png"),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        description: SITE_DESCRIPTION,
        inLanguage: "zh-CN",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/explore?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

interface BreadcrumbJsonLdItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbJsonLdItem[]) {
  const validItems = items.filter((item) => item.name.trim() && item.url.trim());

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: validItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name.trim(),
      item: buildAbsoluteUrl(item.url),
    })),
  };
}

interface CourseJsonLdLesson {
  id: string | number;
  title: string;
  summary?: string | null;
  durationMinutes?: number | null;
}

interface CourseJsonLdInput {
  id: string | number;
  title: string;
  description?: string | null;
  image?: string | null;
  lessons?: CourseJsonLdLesson[] | null;
}

export function buildCourseJsonLd(course: CourseJsonLdInput) {
  const url = buildAbsoluteUrl(`/courses/${course.id}`);
  const siteUrl = getSiteUrl();
  const description = course.description?.trim() || undefined;
  const parts = (course.lessons ?? []).flatMap((lesson) => {
    const name = lesson.title.trim();
    if (!name) return [];

    const lessonUrl = buildAbsoluteUrl(`/courses/${course.id}/lessons/${lesson.id}`);
    const summary = lesson.summary?.trim() || undefined;
    const duration =
      typeof lesson.durationMinutes === "number" && lesson.durationMinutes > 0
        ? `PT${lesson.durationMinutes}M`
        : undefined;

    return [
      {
        "@type": "LearningResource",
        "@id": `${lessonUrl}#learning-resource`,
        name,
        url: lessonUrl,
        ...(summary ? { description: summary } : {}),
        ...(duration ? { timeRequired: duration } : {}),
      },
    ];
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        "@id": `${url}#course`,
        name: course.title,
        url,
        inLanguage: "zh-CN",
        ...(description ? { description } : {}),
        ...(toAbsoluteMediaUrl(course.image) ? { image: toAbsoluteMediaUrl(course.image) } : {}),
        provider: {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          name: SITE_NAME,
          url: siteUrl,
        },
        ...(parts.length > 0 ? { hasPart: parts } : {}),
      },
    ],
  };
}

interface LessonJsonLdStep {
  title?: string | null;
  description?: string | null;
}

interface LessonJsonLdInput {
  id: string | number;
  courseId: string | number;
  courseTitle: string;
  title: string;
  description?: string | null;
  image?: string | null;
  durationMinutes?: number | null;
  steps?: LessonJsonLdStep[] | null;
}

export function buildLessonJsonLd(lesson: LessonJsonLdInput) {
  const url = buildAbsoluteUrl(`/courses/${lesson.courseId}/lessons/${lesson.id}`);
  const courseUrl = buildAbsoluteUrl(`/courses/${lesson.courseId}`);
  const description = lesson.description?.trim() || undefined;
  const duration =
    typeof lesson.durationMinutes === "number" && lesson.durationMinutes > 0
      ? `PT${lesson.durationMinutes}M`
      : undefined;
  const parts = (lesson.steps ?? []).flatMap((step, index) => {
    const name = step.title?.trim();
    const text = step.description?.trim();
    if (!name && !text) return [];

    return [
      {
        "@type": "HowToStep",
        position: index + 1,
        name: name || text,
        ...(text ? { text } : {}),
      },
    ];
  });

  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#learning-resource`,
    name: lesson.title,
    headline: lesson.title,
    url,
    inLanguage: "zh-CN",
    learningResourceType: "在线课程课时",
    isPartOf: {
      "@type": "Course",
      name: lesson.courseTitle,
      url: courseUrl,
    },
    ...(description ? { description } : {}),
    ...(duration ? { timeRequired: duration } : {}),
    ...(toAbsoluteMediaUrl(lesson.image) ? { image: toAbsoluteMediaUrl(lesson.image) } : {}),
    ...(parts.length > 0 ? { hasPart: parts } : {}),
  };
}

interface SpeciesProfileJsonLdObservation {
  id: string | number;
  title?: string | null;
}

interface SpeciesProfileJsonLdInput {
  slug: string;
  commonName: string;
  scientificName?: string | null;
  aliases?: string[] | null;
  description?: string | null;
  image?: string | null;
  recentObservations?: SpeciesProfileJsonLdObservation[] | null;
}

export function buildSpeciesProfileJsonLd(species: SpeciesProfileJsonLdInput) {
  const url = buildAbsoluteUrl(`/nature/species/${species.slug}`);
  const siteUrl = getSiteUrl();
  const taxonId = `${url}#taxon`;
  const description = species.description?.trim() || undefined;
  const aliases = (species.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
  const observations = (species.recentObservations ?? []).flatMap((observation) => {
    const observationUrl = buildAbsoluteUrl(`/nature/observations/${observation.id}`);
    const name = observation.title?.trim();

    return [
      {
        "@type": "ListItem",
        position: 0,
        item: {
          "@type": "WebPage",
          url: observationUrl,
          ...(name ? { name } : {}),
        },
      },
    ];
  });

  observations.forEach((item, index) => {
    item.position = index + 1;
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        name: `${species.commonName} · 物种档案`,
        url,
        inLanguage: "zh-CN",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          name: SITE_NAME,
          url: siteUrl,
        },
        mainEntity: { "@id": taxonId },
        about: { "@id": taxonId },
        ...(description ? { description } : {}),
        ...(toAbsoluteMediaUrl(species.image) ? { image: toAbsoluteMediaUrl(species.image) } : {}),
      },
      {
        "@type": "Taxon",
        "@id": taxonId,
        name: species.commonName,
        taxonRank: "species",
        ...(species.scientificName?.trim() ? { scientificName: species.scientificName.trim() } : {}),
        ...(aliases.length > 0 ? { alternateName: aliases } : {}),
      },
      ...(observations.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${url}#recent-observations`,
              name: `${species.commonName}近期观察记录`,
              itemListElement: observations,
            },
          ]
        : []),
    ],
  };
}

interface ProjectJsonLdInput {
  id: string | number;
  title: string;
  description?: string | null;
  image?: string | null;
  steps?: Array<{
    title?: string | null;
    description?: string | null;
    image_url?: string | null;
  }> | null;
}

export function buildProjectJsonLd(project: ProjectJsonLdInput) {
  const url = buildAbsoluteUrl(`/project/${project.id}`);
  const image = toAbsoluteMediaUrl(project.image);
  const description = project.description?.trim() || undefined;
  const howToSteps = (project.steps ?? []).flatMap((step, index) => {
    const name = step.title?.trim();
    const text = step.description?.trim();
    if (!name && !text) return [];

    return [
      {
        "@type": "HowToStep",
        position: index + 1,
        name: name || text,
        ...(text ? { text } : {}),
        ...(toAbsoluteMediaUrl(step.image_url) ? { image: toAbsoluteMediaUrl(step.image_url) } : {}),
      },
    ];
  });

  const article = {
    "@type": "Article",
    headline: project.title,
    mainEntityOfPage: url,
    url,
    inLanguage: "zh-CN",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  };

  if (howToSteps.length === 0) {
    return {
      "@context": "https://schema.org",
      ...article,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      article,
      {
        "@type": "HowTo",
        name: project.title,
        url,
        ...(description ? { description } : {}),
        ...(image ? { image } : {}),
        step: howToSteps,
      },
    ],
  };
}

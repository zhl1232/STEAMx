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

interface WorkJsonLdInput {
  id: string | number;
  title: string;
  description?: string | null;
  images?: string[] | null;
  author?: string | null;
  dateCreated?: string | null;
}

export function buildWorkJsonLd(work: WorkJsonLdInput) {
  const url = buildAbsoluteUrl(`/works/${work.id}`);
  const description = work.description?.trim() || undefined;
  const images = (work.images ?? []).flatMap((image) => {
    const absolute = toAbsoluteMediaUrl(image);
    return absolute ? [absolute] : [];
  });

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#creative-work`,
    name: work.title,
    headline: work.title,
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${getSiteUrl()}/#website`,
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    ...(description ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(work.author?.trim()
      ? { creator: { "@type": "Person", name: work.author.trim() } }
      : {}),
    ...(work.dateCreated?.trim() ? { dateCreated: work.dateCreated.trim() } : {}),
  };
}

interface ObservationJsonLdSpecies {
  commonName: string;
  scientificName?: string | null;
  slug?: string | null;
}

interface ObservationJsonLdInput {
  id: string | number;
  title: string;
  description?: string | null;
  images?: string[] | null;
  author?: string | null;
  observedAt?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  species?: ObservationJsonLdSpecies[] | null;
}

export function buildObservationJsonLd(observation: ObservationJsonLdInput) {
  const url = buildAbsoluteUrl(`/nature/observations/${observation.id}`);
  const description = observation.description?.trim() || undefined;
  const images = (observation.images ?? []).flatMap((image) => {
    const absolute = toAbsoluteMediaUrl(image);
    return absolute ? [absolute] : [];
  });
  const about = (observation.species ?? []).flatMap((species) => {
    const name = species.commonName.trim();
    if (!name) return [];

    return [{
      "@type": "Taxon",
      name,
      ...(species.scientificName?.trim() ? { scientificName: species.scientificName.trim() } : {}),
      ...(species.slug?.trim()
        ? { url: buildAbsoluteUrl(`/nature/species/${species.slug.trim()}`) }
        : {}),
    }];
  });
  const hasCoordinates = typeof observation.latitude === "number"
    && typeof observation.longitude === "number";
  const locationName = observation.locationName?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#observation`,
    name: observation.title,
    headline: observation.title,
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    ...(description ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(observation.author?.trim()
      ? { creator: { "@type": "Person", name: observation.author.trim() } }
      : {}),
    ...(observation.observedAt?.trim() ? { dateCreated: observation.observedAt.trim() } : {}),
    ...(about.length > 0 ? { about } : {}),
    ...(locationName || hasCoordinates
      ? {
          contentLocation: {
            "@type": "Place",
            ...(locationName ? { name: locationName } : {}),
            ...(hasCoordinates
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: observation.latitude,
                    longitude: observation.longitude,
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

interface LearningResourceJsonLdInput {
  id: string | number;
  title: string;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
}

export function buildLearningResourceJsonLd(resource: LearningResourceJsonLdInput) {
  const url = buildAbsoluteUrl(`/resources/${resource.id}`);
  const description = resource.description?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#learning-resource`,
    name: resource.title,
    headline: resource.title,
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      "@id": `${getSiteUrl()}/#organization`,
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    ...(description ? { description } : {}),
    ...(toAbsoluteMediaUrl(resource.image) ? { image: toAbsoluteMediaUrl(resource.image) } : {}),
    ...(resource.category?.trim() ? { learningResourceType: resource.category.trim() } : {}),
    ...(resource.datePublished?.trim() ? { datePublished: resource.datePublished.trim() } : {}),
    ...(resource.dateModified?.trim() ? { dateModified: resource.dateModified.trim() } : {}),
  };
}

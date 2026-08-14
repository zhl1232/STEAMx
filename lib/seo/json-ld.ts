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
      },
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

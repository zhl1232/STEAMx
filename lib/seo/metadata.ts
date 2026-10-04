import type { Metadata } from "next";
import { toPublicImageUrl } from "@/lib/seo/public-image";

import { SITE_NAME, buildAbsoluteUrl } from "@/lib/seo/site";
import { buildSegmentTitle, stripSiteTitleSuffix } from "@/lib/seo/title";

export const DEFAULT_SOCIAL_IMAGE = "/assets/seo/steamx-social-card.webp";

export const DEFAULT_SEO_KEYWORDS = [
  "创探空间",
  "STEAM",
  "少儿STEAM",
  "少儿编程",
  "免费少儿编程",
  "积木",
  "积木课程",
  "科学实践",
  "自然观察",
  "积木课",
  "PBL",
  "3-16岁",
  "科学实验",
  "科学小实验",
  "创客教育",
];

function uniqueKeywords(keywords: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword?.trim())
        .filter((keyword): keyword is string => Boolean(keyword)),
    ),
  );
}

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: Array<string | null | undefined>;
  image?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
  /**
   * With `noIndex`, still let crawlers follow links (`noindex, follow`).
   * Use for real pages that are only hidden from discovery (e.g. unlisted courses
   * that point to a successor); keep the default `nofollow` for missing pages.
   */
  noIndexFollow?: boolean;
  /** Skip the root layout title template. Needed on the `/` segment, which does not inherit it. */
  absoluteTitle?: boolean;
  /**
   * Omit metadata-driven canonical / openGraph.url.
   * Use on `/` with {@link HomepageCanonicalTags}: Next Metadata strips the trailing slash on `/`.
   */
  omitCanonical?: boolean;
}

/** Navigation / tracking query params that must never appear in a canonical URL. */
export const TRACKING_QUERY_PARAMS = ["from", "sourceIndex", "ref", "source", "spm", "gclid", "fbclid"] as const;

function isTrackingQueryParam(key: string): boolean {
  return (TRACKING_QUERY_PARAMS as readonly string[]).includes(key) || key.toLowerCase().startsWith("utm_");
}

/**
 * Absolute canonical URL for a route path. Tracking params (`?from=`, `?sourceIndex=`,
 * `utm_*`, …) and fragments are always removed. Detail pages pass bare paths; the only
 * query strings that survive are deliberate pagination canonicals such as
 * `/explore?sortBy=latest&page=1` built by the caller.
 */
export function buildCanonicalUrl(path: string): string {
  const url = new URL(path || "/", buildAbsoluteUrl("/"));
  for (const key of Array.from(url.searchParams.keys())) {
    if (isTrackingQueryParam(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [],
  image,
  type = "website",
  noIndex = false,
  noIndexFollow = false,
  absoluteTitle = false,
  omitCanonical = false,
}: PageMetadataOptions): Metadata {
  const mergedKeywords = uniqueKeywords([...DEFAULT_SEO_KEYWORDS, ...keywords]);
  const contentImage = toPublicImageUrl(image);
  const socialImage = contentImage || toPublicImageUrl(DEFAULT_SOCIAL_IMAGE)!;
  const absoluteUrl = buildCanonicalUrl(path);
  const pageTitle = absoluteTitle ? title : stripSiteTitleSuffix(title);

  return {
    title: absoluteTitle ? { absolute: title } : buildSegmentTitle(pageTitle),
    description,
    keywords: mergedKeywords,
    ...(omitCanonical
      ? {}
      : {
          alternates: {
            canonical: absoluteUrl,
          },
        }),
    openGraph: {
      title: pageTitle,
      description,
      ...(omitCanonical ? {} : { url: absoluteUrl }),
      siteName: SITE_NAME,
      locale: "zh_CN",
      type,
      images: [{
        url: socialImage,
        ...(!contentImage ? { width: 1200, height: 630 } : {}),
        alt: pageTitle,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [socialImage],
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: noIndexFollow,
          },
        }
      : {}),
  };
}

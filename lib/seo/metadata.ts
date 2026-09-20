import type { Metadata } from "next";
import { toPublicImageUrl } from "@/lib/seo/public-image";

import { SITE_NAME, buildAbsoluteUrl } from "@/lib/seo/site";

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
  /** Skip the root layout title template. Needed on the `/` segment, which does not inherit it. */
  absoluteTitle?: boolean;
  /**
   * Omit metadata-driven canonical / openGraph.url.
   * Use on `/` with {@link HomepageCanonicalTags}: Next Metadata strips the trailing slash on `/`.
   */
  omitCanonical?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [],
  image,
  type = "website",
  noIndex = false,
  absoluteTitle = false,
  omitCanonical = false,
}: PageMetadataOptions): Metadata {
  const mergedKeywords = uniqueKeywords([...DEFAULT_SEO_KEYWORDS, ...keywords]);
  const contentImage = toPublicImageUrl(image);
  const socialImage = contentImage || toPublicImageUrl(DEFAULT_SOCIAL_IMAGE)!;
  const absoluteUrl = buildAbsoluteUrl(path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
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
      title,
      description,
      ...(omitCanonical ? {} : { url: absoluteUrl }),
      siteName: SITE_NAME,
      locale: "zh_CN",
      type,
      images: [{
        url: socialImage,
        ...(!contentImage ? { width: 1200, height: 630 } : {}),
        alt: title,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {}),
  };
}

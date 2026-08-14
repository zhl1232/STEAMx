import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/seo/site";

export const DEFAULT_SEO_KEYWORDS = [
  "STEAM",
  "STEAM教育",
  "项目式学习",
  "PBL",
  "科学实验",
  "创客教育",
  "自然观察",
  "鸟类观察",
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
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [],
  image,
  type = "website",
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const mergedKeywords = uniqueKeywords([...DEFAULT_SEO_KEYWORDS, ...keywords]);

  return {
    title,
    description,
    keywords: mergedKeywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "zh_CN",
      type,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
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

import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/seo/site";

export const DEFAULT_SOCIAL_IMAGE = "/assets/seo/steamx-social-card.webp";

export const DEFAULT_SEO_KEYWORDS = [
  "STEAMX",
  "史迪姆",
  "STEAM",
  "少儿编程",
  "积木",
  "观鸟",
  "积木课",
  "PBL",
  "科学实验",
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
  const socialImage = image || DEFAULT_SOCIAL_IMAGE;

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
      images: [{
        url: socialImage,
        ...(!image ? { width: 1200, height: 630 } : {}),
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

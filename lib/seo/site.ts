import { isProductionSiteHost } from "@/lib/seo/canonical-host";
import {
  BRAND_DESCRIPTION,
  BRAND_FULL_NAME,
  BRAND_OFFICIAL_URL,
} from "@/lib/brand";

const LOCAL_SITE_URL = "http://localhost:3000";
const PRODUCTION_FALLBACK_SITE_URL = BRAND_OFFICIAL_URL;

/** The formal site name used in metadata, structured data, and public copy. */
export const SITE_NAME = BRAND_FULL_NAME;
export const HOME_PAGE_TITLE = "少儿 STEAM 课程、积木搭建与科学实践";
export const HOME_DOCUMENT_TITLE = `${BRAND_FULL_NAME}｜${HOME_PAGE_TITLE}`;
/** Default meta / Open Graph / Twitter description (also used on about & PWA). */
export const SITE_DESCRIPTION = BRAND_DESCRIPTION;
/** Keep structured descriptions aligned with visible public copy. */
export const SITE_STRUCTURED_DESCRIPTION = BRAND_DESCRIPTION;
export const ICP_FILING_NUMBER = "京ICP备2025129751号-3";
export const ICP_FILING_URL = "https://beian.miit.gov.cn/";

function normalizeSiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase();
    if (isProductionSiteHost(hostname)) {
      return PRODUCTION_FALLBACK_SITE_URL;
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  // Canonical SEO URLs must never inherit an internal deployment origin.
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_FALLBACK_SITE_URL;
  }

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeSiteUrl(candidate);
    if (!normalized) continue;

    return normalized;
  }

  return LOCAL_SITE_URL;
}

export function getMetadataBase() {
  return new URL(`${getSiteUrl()}/`);
}

export function buildAbsoluteUrl(path = "/") {
  return new URL(path, getMetadataBase()).toString();
}

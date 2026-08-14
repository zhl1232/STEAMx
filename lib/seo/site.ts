const LOCAL_SITE_URL = "http://localhost:3000";
const PRODUCTION_FALLBACK_SITE_URL = "https://www.steamx.cc";

export const SITE_NAME = "STEAM 探索";
export const SITE_DESCRIPTION =
  "STEAM 项目式学习与自然观察社区，围绕科学实验、技术制作、工程搭建、艺术创作、数学思维和鸟类观察，发现、分享并完成真实项目。";
export const ICP_FILING_NUMBER = "京ICP备2025129751号-2";
export const ICP_FILING_URL = "https://beian.miit.gov.cn/";

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeSiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return null;
  }
}

export function getSiteUrl() {
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

    const hostname = new URL(normalized).hostname;
    if (process.env.NODE_ENV === "production" && isLocalHostname(hostname)) {
      continue;
    }

    return normalized;
  }

  return process.env.NODE_ENV === "production"
    ? PRODUCTION_FALLBACK_SITE_URL
    : LOCAL_SITE_URL;
}

export function getMetadataBase() {
  return new URL(`${getSiteUrl()}/`);
}

export function buildAbsoluteUrl(path = "/") {
  return new URL(path, getMetadataBase()).toString();
}

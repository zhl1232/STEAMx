/** 生产主域与旧域并存：主域 steam.bj.cn；旧域 steamx.cc 保留入口并跳到主域。 */

export const PRIMARY_HOST = "steam.bj.cn";
export const PRIMARY_ORIGIN = `https://${PRIMARY_HOST}`;

/** @deprecated 旧 apex；仍作为保留域名入口 */
export const STEAMX_APEX_HOST = "steamx.cc";
/** @deprecated 旧 www；仍作为保留域名入口 */
export const STEAMX_WWW_HOST = "www.steamx.cc";

export const STEAM_BJ_WWW_HOST = "www.steam.bj.cn";

/** 访问这些 host 时 301 到 PRIMARY_ORIGIN（保留路径与查询）。主域本身不跳。 */
export const LEGACY_REDIRECT_HOSTS = [
  STEAMX_APEX_HOST,
  STEAMX_WWW_HOST,
  STEAM_BJ_WWW_HOST,
] as const;

const LEGACY_REDIRECT_HOST_SET = new Set<string>(LEGACY_REDIRECT_HOSTS);

/** 视为「正式站点」的 host：SEO / normalize 时归一到主域。 */
export const PRODUCTION_SITE_HOSTS = [
  PRIMARY_HOST,
  STEAM_BJ_WWW_HOST,
  STEAMX_APEX_HOST,
  STEAMX_WWW_HOST,
] as const;

const PRODUCTION_SITE_HOST_SET = new Set<string>(PRODUCTION_SITE_HOSTS);

export function getRequestHostname(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";

  const trimmed = hostHeader.trim().toLowerCase();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }

  return trimmed.split(":")[0] ?? "";
}

/** 旧域 steamx 入口：响应应带 noindex，避免与主域抢 SEO。不含 www.steam.bj.cn / 主域 / dev。 */
export const STEAMX_NOINDEX_HOSTS = [
  STEAMX_APEX_HOST,
  STEAMX_WWW_HOST,
] as const;

const STEAMX_NOINDEX_HOST_SET = new Set<string>(STEAMX_NOINDEX_HOSTS);

export const X_ROBOTS_TAG_NOINDEX = "noindex";

export function shouldNoIndexSteamxHost(hostHeader: string | null | undefined): boolean {
  return STEAMX_NOINDEX_HOST_SET.has(getRequestHostname(hostHeader));
}

/** 非生产 host（dev.steamx.cc、预览域等）的整站 X-Robots-Tag。 */
export const X_ROBOTS_TAG_NOINDEX_NOFOLLOW = "noindex, nofollow";

/** 仍可被索引的正式主域（www.steam.bj.cn 会 301 到主域）。 */
const INDEXABLE_HOST_SET = new Set<string>([PRIMARY_HOST, STEAM_BJ_WWW_HOST]);

function isLoopbackOrIpHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.includes(":")) return true; // IPv6 literal
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * dev.steamx.cc / 其它 *.steamx.cc / 预览域等公网非生产 host：整站 noindex, nofollow，避免与 steam.bj.cn 抢收录。
 * 主域、www.steam.bj.cn 不受影响；localhost、IP、无点内部名、空 host 也不加
 * （生产 Nginx 部分 location 不透传 Host，Next 会看到 127.0.0.1:3000，不能误伤）。
 * 显式排除旧域 steamx.cc / www.steamx.cc：仅带 noindex，不加 nofollow，避免干扰百度改版权重迁移；不依赖 301 分支。
 */
export function shouldNoIndexNonProductionHost(hostHeader: string | null | undefined): boolean {
  const hostname = getRequestHostname(hostHeader);
  if (STEAMX_NOINDEX_HOST_SET.has(hostname)) return false;
  if (!hostname || !hostname.includes(".")) return false;
  if (isLoopbackOrIpHost(hostname)) return false;
  return !INDEXABLE_HOST_SET.has(hostname);
}

export function isProductionSiteHost(hostHeader: string | null | undefined): boolean {
  return PRODUCTION_SITE_HOST_SET.has(getRequestHostname(hostHeader));
}

/**
 * 旧域 / 主域 www → https://steam.bj.cn，保留 path + query。
 * 主域 apex（steam.bj.cn）不跳转。
 */
export function buildCanonicalHostRedirectUrl(input: {
  host: string | null | undefined;
  pathname: string;
  search?: string;
}): string | null {
  const hostname = getRequestHostname(input.host);
  if (!LEGACY_REDIRECT_HOST_SET.has(hostname)) {
    return null;
  }

  const pathname = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  const search = input.search ?? "";
  return `${PRIMARY_ORIGIN}${pathname}${search}`;
}

/** @deprecated 使用 buildCanonicalHostRedirectUrl；行为已改为跳到 steam.bj.cn */
export const buildApexToWwwRedirectUrl = buildCanonicalHostRedirectUrl;

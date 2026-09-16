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

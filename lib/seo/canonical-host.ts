/** 仅处理当前生产主域的 apex ↔ www，不改写其他域名。 */
export const STEAMX_APEX_HOST = "steamx.cc";
export const STEAMX_WWW_HOST = "www.steamx.cc";

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

export function buildApexToWwwRedirectUrl(input: {
  host: string | null | undefined;
  pathname: string;
  search?: string;
}): string | null {
  if (getRequestHostname(input.host) !== STEAMX_APEX_HOST) {
    return null;
  }

  const pathname = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  const search = input.search ?? "";
  return `https://${STEAMX_WWW_HOST}${pathname}${search}`;
}

import { sanitizeInternalHref } from "@/lib/utils/safe-internal-href"

export const STEAM_PATHNAME_HEADER = "x-steam-pathname"
export const STEAM_SEARCH_HEADER = "x-steam-search"

export function isPublicSettingsPath(pathname: string) {
  return pathname === "/settings/about"
}

export function buildLoginRedirect(nextPath?: string | null) {
  const next = sanitizeInternalHref(nextPath)
  if (next === "/") return "/login"
  return `/login?next=${encodeURIComponent(next)}`
}

export function buildLoginRedirectFromRequestHeaders(headerList: Headers) {
  const pathname = headerList.get(STEAM_PATHNAME_HEADER) || "/"
  const search = headerList.get(STEAM_SEARCH_HEADER) || ""
  return buildLoginRedirect(`${pathname}${search}`)
}

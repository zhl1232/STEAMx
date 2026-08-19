const MAX_INTERNAL_HREF_LENGTH = 512

/**
 * Same-origin relative paths only. Rejects protocol-relative URLs, backslashes,
 * embedded schemes, and `..` traversal so `from` / `next` cannot bounce users
 * off-site or out of the intended page.
 */
export function isSafeInternalHref(value: string | null | undefined): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_INTERNAL_HREF_LENGTH) {
    return false
  }
  if (!value.startsWith("/")) return false
  if (value.startsWith("//") || value.startsWith("/\\")) return false
  if (value.includes("\\") || value.includes("://")) return false
  if (/[\s<>'"\p{Control}]/u.test(value)) return false

  const pathOnly = value.split(/[?#]/, 1)[0]
  if (pathOnly.split("/").includes("..")) return false

  return true
}

export function sanitizeInternalHref(
  value: string | null | undefined,
  fallbackHref = "/",
): string {
  return isSafeInternalHref(value) ? value : fallbackHref
}

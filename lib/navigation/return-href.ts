/**
 * "Where did the user come from?" for in-app back links, kept in sessionStorage
 * instead of a `?from=` query param so internal links stay canonical.
 *
 * `ReturnHrefTracker` records `{ target pathname → current URL }` when the user
 * clicks an internal link into a tracked section; back links on the target page
 * resolve it with `resolveReturnHref(raw, pathname, fallback)`.
 */
import { isSafeInternalHref } from '@/lib/utils/safe-internal-href'

export const RETURN_HREF_STORAGE_KEY = 'steamx-return-href-v1'
const MAX_ENTRIES = 30

/** Sections whose detail pages return to the page that opened them. */
export const RETURN_TRACKED_PREFIXES = ['/nature/', '/store/products/'] as const

type ReturnHrefEntry = { path: string; from: string }

export function isReturnTrackedPath(pathname: string): boolean {
  return RETURN_TRACKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function parseEntries(raw: string | null): ReturnHrefEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is ReturnHrefEntry =>
      Boolean(entry)
      && typeof (entry as ReturnHrefEntry).path === 'string'
      && isSafeInternalHref((entry as ReturnHrefEntry).from),
    )
  } catch {
    return []
  }
}

export function readReturnHrefRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(RETURN_HREF_STORAGE_KEY)
  } catch {
    return null
  }
}

export function resolveReturnHref(raw: string | null, pathname: string, fallbackHref: string): string {
  const entry = parseEntries(raw).find((item) => item.path === pathname)
  return entry && entry.from !== pathname ? entry.from : fallbackHref
}

export function rememberReturnHref(targetPathname: string, fromHref: string): void {
  if (typeof window === 'undefined') return
  if (!targetPathname.startsWith('/') || !isSafeInternalHref(fromHref)) return
  if (fromHref.split(/[?#]/, 1)[0] === targetPathname) return
  try {
    const entries = parseEntries(sessionStorage.getItem(RETURN_HREF_STORAGE_KEY))
      .filter((entry) => entry.path !== targetPathname)
    entries.unshift({ path: targetPathname, from: fromHref })
    sessionStorage.setItem(RETURN_HREF_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // sessionStorage may be unavailable
  }
}

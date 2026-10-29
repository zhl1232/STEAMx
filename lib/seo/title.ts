import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/seo/site";

/** Site-wide document title suffix. Keep in sync with the root layout `title.template`. */
export const SITE_TITLE_SEPARATOR = " | ";
export const SITE_TITLE_TEMPLATE = `%s${SITE_TITLE_SEPARATOR}${SITE_NAME}`;

const escapedSiteName = SITE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Matches any trailing brand suffix a caller may have hard-coded: " | 创探空间", "｜创探空间", " · 创探空间", " - 创探空间".
const TRAILING_SITE_NAME_RE = new RegExp(`(?:\\s*[|｜·\\-—–]\\s*${escapedSiteName})+\\s*$`, "u");

/** Page title without any trailing brand suffix. */
export function stripSiteTitleSuffix(title: string): string {
  return title.replace(TRAILING_SITE_NAME_RE, "").trim();
}

/** `X` → `X | 创探空间`; never produces a double suffix. */
export function formatDocumentTitle(title: string): string {
  const base = stripSiteTitleSuffix(title);
  return base ? `${base}${SITE_TITLE_SEPARATOR}${SITE_NAME}` : SITE_NAME;
}

/**
 * Title metadata for any route segment below the root layout.
 *
 * Next.js only applies a parent `title.template` to the *direct* resolution of a
 * string title and resets the template for descendants whenever a segment sets a
 * plain string title (e.g. `/playground` layout → `/playground/sudoku` rendered
 * without the brand suffix). Emitting the fully formatted `absolute` title plus
 * the same `template` keeps every level consistent and idempotent.
 */
export function buildSegmentTitle(title: string): NonNullable<Metadata["title"]> {
  return {
    absolute: formatDocumentTitle(title),
    template: SITE_TITLE_TEMPLATE,
  };
}

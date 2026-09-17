import { buildAbsoluteUrl } from "@/lib/seo/site";

/**
 * Next.js Metadata API normalizes the homepage canonical/og:url to
 * `https://steam.bj.cn` (no trailing slash). Emit raw head tags so production
 * HTML keeps the slash-terminated form from `buildAbsoluteUrl("/")`.
 *
 * Only mount on the homepage, and do not also set metadata `alternates.canonical`
 * / `openGraph.url` for `/` (avoids duplicate conflicting tags).
 */
export function HomepageCanonicalTags() {
  const href = buildAbsoluteUrl("/");

  return (
    <>
      <link rel="canonical" href={href} />
      <meta property="og:url" content={href} />
    </>
  );
}

import { buildAbsoluteUrl } from '@/lib/seo/site';
import { isProductionSiteHost } from '@/lib/seo/canonical-host';
import { getAssetsBaseUrl, toForcedAssetProxyUrl } from '@/lib/utils/asset-url';

/** Use the same public asset delivery path as the page, including migrated images. */
export function toPublicImageUrl(value: string | null | undefined): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  // Metadata images must be fetchable URLs, never inline data or executable schemes.
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return undefined;
  try {
    const normalized = input.startsWith('//') ? `https:${input}`
      : /^https?:\/\//i.test(input) || input.startsWith('/') ? input : `/${input}`;
    if (/^https?:\/\//i.test(normalized)) {
      const source = new URL(normalized);
      const base = getAssetsBaseUrl();
      let configuredCdn = false;
      if (base) {
        try {
          const cdn = new URL(base);
          const prefix = cdn.pathname.replace(/\/+$/, '');
          configuredCdn = source.origin === cdn.origin && source.pathname.startsWith(`${prefix}/`);
        } catch { /* A malformed optional CDN setting must not rewrite third-party images. */ }
      }
      const siteOwned = isProductionSiteHost(source.hostname)
        || source.origin === new URL(buildAbsoluteUrl('/')).origin
        || source.hostname === 'assets.steamx.cc';
      // A third-party /projects/... URL is not one of our migrated local images.
      if (!configuredCdn && !siteOwned) return source.toString();
    }
    return buildAbsoluteUrl(toForcedAssetProxyUrl(normalized) ?? normalized);
  } catch {
    return undefined;
  }
}

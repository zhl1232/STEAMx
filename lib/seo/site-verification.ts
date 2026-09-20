import type { Metadata } from "next";

/**
 * Hard-coded platform tokens already issued for this site.
 * Google / Baidu / Bing meta tokens stay optional via env so operators can rotate
 * without inventing placeholders in the repo.
 */
export const HARDCODED_SITE_VERIFICATION_OTHER = {
  "shenma-site-verification": "0a369998178eeb11b680c60e4cfb19c5_1788321740",
  "bytedance-verification-code": "QhQxrClFv1UxcRI2mUkd",
} as const;

function readOptionalToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Build Next.js `metadata.verification` from env + known platform tokens. */
export function buildSiteVerificationMetadata(): NonNullable<Metadata["verification"]> {
  const google = readOptionalToken(process.env.GOOGLE_SITE_VERIFICATION);
  const baidu = readOptionalToken(process.env.BAIDU_SITE_VERIFICATION);

  const bing = readOptionalToken(process.env.BING_SITE_VERIFICATION);

  return {
    ...(google ? { google } : {}),
    other: {
      ...HARDCODED_SITE_VERIFICATION_OTHER,
      ...(bing ? { "msvalidate.01": bing } : {}),
      ...(baidu ? { "baidu-site-verification": baidu } : {}),
    },
  };
}

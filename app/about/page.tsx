import type { Metadata } from "next";

import AboutSettingsPage from "@/app/settings/about/page";
import { JsonLd } from "@/components/seo/json-ld";
import { BRAND_FULL_NAME } from "@/lib/brand";
import {
  buildAboutPageJsonLd,
  buildBrandFaqPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_STRUCTURED_DESCRIPTION } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: `关于 ${BRAND_FULL_NAME}`,
  description: SITE_STRUCTURED_DESCRIPTION,
  path: "/about",
  keywords: [
    "关于STEAMX",
    "STEAMX是什么",
    "史迪姆是什么",
    "少儿STEAM",
    "帮助中心",
    "联系我们",
    "问题反馈",
  ],
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={buildAboutPageJsonLd()} />
      <JsonLd data={buildBrandFaqPageJsonLd()} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "首页", url: "/" },
          { name: `关于 ${BRAND_FULL_NAME}`, url: "/about" },
        ])}
      />
      {/* Crawlable brand definition stays in the shared about body; metadata + JSON-LD live here. */}
      <AboutSettingsPage />
    </>
  );
}

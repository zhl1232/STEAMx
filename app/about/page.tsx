import type { Metadata } from "next";

import AboutSettingsPage from "@/app/settings/about/page";
import { SITE_DESCRIPTION } from "@/lib/seo/site";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "关于与帮助",
  description: SITE_DESCRIPTION,
  path: "/about",
  keywords: ["关于STEAMX", "帮助中心", "联系我们", "问题反馈"],
});

export default function AboutPage() {
  return <AboutSettingsPage />;
}

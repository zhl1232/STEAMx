import type { Metadata } from "next";

import AboutSettingsPage from "@/app/settings/about/page";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "关于与帮助",
  description: "了解 STEAMX · 史迪姆，查看常见问题、平台规则与联系反馈方式。",
  path: "/about",
  keywords: ["关于STEAMX", "帮助中心", "联系我们", "问题反馈"],
});

export default function AboutPage() {
  return <AboutSettingsPage />;
}

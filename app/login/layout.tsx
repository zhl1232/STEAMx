import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { BRAND_FULL_NAME } from "@/lib/brand";

export const metadata: Metadata = buildPageMetadata({
  title: "登录",
  description: `登录 ${BRAND_FULL_NAME}，发布项目、参与社区挑战、保存游乐场进度并记录自然观察。`,
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

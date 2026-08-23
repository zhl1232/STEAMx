import type { Metadata } from "next";

import DesignSystemContent from "@/components/features/design-system-content";
import { BRAND_FULL_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Design System",
  description: `${BRAND_FULL_NAME}的设计系统静态展示页。`,
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/design-system",
  },
};

export default function DesignSystemPage() {
  return <DesignSystemContent />;
}

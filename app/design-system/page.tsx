import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DesignSystemContent from "@/components/features/design-system-content";
import { BRAND_FULL_NAME } from "@/lib/brand";
import { isDevelopmentMode } from "@/lib/development-only";

export function generateMetadata(): Metadata {
  if (!isDevelopmentMode()) notFound();
  return {
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
}

export default function DesignSystemPage() {
  if (!isDevelopmentMode()) notFound();
  return <DesignSystemContent />;
}

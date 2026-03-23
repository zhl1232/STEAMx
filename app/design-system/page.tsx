import type { Metadata } from "next";

import DesignSystemContent from "@/components/features/design-system-content";

export const metadata: Metadata = {
  title: "Design System",
  description: "STEAM 探索的设计系统静态展示页。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignSystemPage() {
  return <DesignSystemContent />;
}

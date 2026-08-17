import type { Metadata } from "next";

import { buildPlaygroundMetadata } from "@/lib/seo/playground-metadata";

export const metadata: Metadata = buildPlaygroundMetadata("/playground/memory");

export default function PlaygroundRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

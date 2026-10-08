import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { buildPlaygroundJsonLd, buildPlaygroundMetadata } from "@/lib/seo/playground-metadata";

export const metadata: Metadata = buildPlaygroundMetadata("/playground/maze");

export default function PlaygroundRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={buildPlaygroundJsonLd("/playground/maze")} />
      {children}
    </>
  );
}

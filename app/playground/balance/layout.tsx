import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { buildPlaygroundJsonLd, buildPlaygroundMetadata } from "@/lib/seo/playground-metadata";

export const metadata: Metadata = buildPlaygroundMetadata("/playground/balance");

export default function PlaygroundRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={buildPlaygroundJsonLd("/playground/balance")} />
      {children}
    </>
  );
}

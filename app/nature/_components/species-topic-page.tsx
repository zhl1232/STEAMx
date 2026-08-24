import type { Metadata } from "next";

import { SpeciesAtlas } from "@/app/nature/species/species-atlas";
import { getSpeciesAtlas } from "@/lib/api/nature-observation-atlas";
import type {
  SpeciesAtlasStatusFilter,
  SpeciesAtlasTopicFilter,
} from "@/lib/nature-species-atlas";
import { buildPageMetadata } from "@/lib/seo/metadata";

interface SpeciesTopicDefinition {
  topic: Exclude<SpeciesAtlasTopicFilter, "all">;
  slug: "birds" | "insects" | "plants";
  title: string;
  description: string;
  keywords: string[];
  image: string;
}

interface SpeciesTopicPageProps {
  definition: SpeciesTopicDefinition;
  searchParams: Promise<{ q?: string; status?: string }>;
}

function normalizeStatus(value: string | undefined): SpeciesAtlasStatusFilter {
  return value === "observed" || value === "unobserved" ? value : "all";
}

export function buildSpeciesTopicMetadata(definition: SpeciesTopicDefinition): Metadata {
  return buildPageMetadata({
    title: definition.title,
    description: definition.description,
    path: `/nature/${definition.slug}`,
    keywords: definition.keywords,
    image: definition.image,
  });
}

export async function SpeciesTopicPage({ definition, searchParams }: SpeciesTopicPageProps) {
  const params = await searchParams;
  const atlas = await getSpeciesAtlas();
  const requestedStatus = normalizeStatus(params.status);
  const initialStatus = atlas.viewer.progressState === "ready" ? requestedStatus : "all";

  return (
    <SpeciesAtlas
      initialData={atlas}
      initialQuery={params.q ?? ""}
      initialTopic={definition.topic}
      initialStatus={initialStatus}
      requestedStatus={requestedStatus}
      canonicalTopicPath={`/nature/${definition.slug}`}
      heading={definition.title}
      introduction={definition.description}
    />
  );
}

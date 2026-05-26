import type { Metadata } from "next";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationSubmitForm } from "@/components/features/bird-observation/observation-submit-form";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { normalizeNatureFrom } from "@/lib/utils/nature-navigation";

interface ObservationSubmitPageProps {
  searchParams: Promise<{
    topic?: string;
    species?: string;
    from?: string;
  }>;
}

export const metadata: Metadata = buildPageMetadata({
  title: "发布观察记录",
  description: "提交自然观察记录，补充物种、地点、时间与媒体信息，把一次观察沉淀为可追踪的图鉴进度。",
  path: "/nature/submit",
  noIndex: true,
});

export default async function ObservationSubmitPage({ searchParams }: ObservationSubmitPageProps) {
  const params = await searchParams;
  const topic = params.topic === "plants" ? "plants" : "birds";
  const { species } = await getSpeciesList({ page: 0, pageSize: 50, topic });
  const isBirdTopic = topic === "birds";
  const initialSpeciesId = params.species ? Number.parseInt(params.species, 10) || null : null;
  const speciesOptions = species.map((item) => ({
    id: item.id,
    commonName: item.commonName,
    scientificName: item.scientificName,
  }));
  const fallbackHref = normalizeNatureFrom(
    params.from,
    isBirdTopic ? "/nature/species?topic=birds" : "/nature/species?topic=plants",
  );

  return (
    <NatureShell
      title="发布观察记录"
      description="记录身边的自然、确认物种和地点，把一次观察沉淀为可追踪的图鉴进度。"
      fallbackHref={fallbackHref}
      className="max-w-none bg-[var(--obs-page-bg,#f3f8f1)] text-foreground dark:bg-[var(--obs-page-bg-dark,#0b1117)]"
      contentClassName="max-w-[1500px] md:px-8"
      mainClassName="space-y-0"
    >
      <ObservationSubmitForm
        speciesOptions={speciesOptions}
        topic={topic}
        initialSpeciesId={initialSpeciesId}
      />
    </NatureShell>
  );
}

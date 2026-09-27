import type { Metadata } from "next";
import Link from "next/link";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationSubmitForm } from "@/components/features/bird-observation/observation-submit-form";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";

interface ObservationSubmitPageProps {
  searchParams: Promise<{
    species?: string;
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
  const { species } = await getSpeciesList({ page: 0, pageSize: 50 });
  const initialSpeciesId = params.species ? Number.parseInt(params.species, 10) || null : null;
  const speciesOptions = species.map((item) => ({
    id: item.id,
    commonName: item.commonName,
    scientificName: item.scientificName,
  }));
  // Back target comes from the remembered referrer (sessionStorage), not `?from=`.
  const fallbackHref = "/nature";

  return (
    <NatureShell
      title="发布观察记录"
      description="记录身边的自然、确认物种和地点，把一次观察沉淀为可追踪的图鉴进度。"
      fallbackHref={fallbackHref}
      variant="wide"
      className="app-canvas max-w-none text-foreground"
      contentClassName="max-w-[1500px]"
      mainClassName="space-y-0"
      mobileHeaderSticky={false}
    >
      <div className="mb-4">
        <Link
          href="/learn/nature#record-observation"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-border/70 bg-background/70 px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          怎样拍照和记录？
        </Link>
      </div>
      <ObservationSubmitForm
        speciesOptions={speciesOptions}
        initialSpeciesId={initialSpeciesId}
      />
    </NatureShell>
  );
}

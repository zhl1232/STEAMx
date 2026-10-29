import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ObservationsListLoadMore } from "@/app/nature/observations/observations-list-load-more";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getObservations } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildNatureObservationPageHref,
  parseNatureObservationPage,
} from "@/lib/seo/nature-observation-pagination";

interface ObservationsPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

const OBSERVATION_DESCRIPTION = "查看社区公开的自然观察记录，了解大家在什么时间、什么地点观察到了哪些物种与生态现象。";
const OBSERVATION_KEYWORDS = ["创探空间 观察记录", "观察记录", "自然观察记录", "观鸟记录", "社区观察"];

export async function generateMetadata({ searchParams }: ObservationsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = parseNatureObservationPage(params.page);
  if (page > 0) {
    const result = await getObservations({ page, pageSize: 12, strictErrors: true });
    if (result.observations.length === 0) notFound();
  }

  return buildPageMetadata({
    title: `观察记录${page > 0 ? ` · 第 ${page + 1} 页` : ""}`,
    description: OBSERVATION_DESCRIPTION,
    path: buildNatureObservationPageHref(page),
    keywords: OBSERVATION_KEYWORDS,
  });
}

export default async function ObservationsPage({ searchParams }: ObservationsPageProps) {
  const params = await searchParams;
  const page = parseNatureObservationPage(params.page);
  const pageSize = 12;
  const { observations, hasMore, total } = await getObservations({ page, pageSize, strictErrors: true });
  if (page > 0 && observations.length === 0) notFound();

  return (
    <div className="app-shell-wide pt-4 pb-24 md:pt-6 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="观察记录" fallbackHref="/nature" />
      </div>

      <section className="surface-panel overflow-hidden max-md:overflow-visible max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-0">
        <div className="py-4 md:px-7 md:py-7 lg:px-8">
          <div className="hidden md:block">
            <p className="section-kicker">自然观察</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">观察记录</h1>
          </div>

          <ObservationsListLoadMore
            key={page}
            initialObservations={observations}
            initialPage={page}
            pageSize={pageSize}
            initialHasMore={hasMore}
            total={total}
          />
        </div>
      </section>
    </div>
  );
}

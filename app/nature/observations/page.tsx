import type { Metadata } from "next";
import Link from "next/link";

import { ObservationsListLoadMore } from "@/app/nature/observations/observations-list-load-more";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getObservations } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "观察记录",
  description: "查看社区公开的自然观察记录，了解大家在什么时间、什么地点观察到了哪些物种与生态现象。",
  path: "/nature/observations",
  keywords: ["观察记录", "自然观察记录", "观鸟记录", "社区观察"],
});

interface ObservationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ObservationsPage({ searchParams }: ObservationsPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const pageSize = 12;
  const { observations, hasMore, total } = await getObservations({ page, pageSize });
  const fromHref = page > 0 ? `/nature/observations?page=${page}` : "/nature/observations";

  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="观察记录" fallbackHref="/nature" className="-mx-4 mb-4" />
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <p className="section-kicker">自然观察</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">观察记录</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            查看大家提交的真实观察记录，看看谁在什么时候、什么地方看到了什么。
          </p>

          <ObservationsListLoadMore
            initialObservations={observations}
            initialPage={page}
            pageSize={pageSize}
            initialHasMore={hasMore}
            total={total}
            fromHref={fromHref}
          />
          <noscript>
            <div className="mt-8 flex justify-end">
              {hasMore ? (
                <Link
                  href={`/nature/observations?page=${page + 1}`}
                  className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70"
                >
                  下一页
                </Link>
              ) : null}
            </div>
          </noscript>
        </div>
      </section>
    </div>
  );
}

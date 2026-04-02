import Link from "next/link";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getObservations } from "@/lib/api/nature-observation-data";

interface ObservationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ObservationsPage({ searchParams }: ObservationsPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const { observations, hasMore } = await getObservations({ page, pageSize: 12 });

  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="观察记录" fallbackHref="/explore" />
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <p className="section-kicker">自然观察</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">观察记录</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            查看大家提交的真实观察记录，看看谁在什么时候、什么地方看到了什么鸟。
          </p>

          <div className="mt-8 space-y-4">
            {observations.map((observation) => (
              <Link
                key={observation.id}
                href={`/explore/observations/${observation.id}`}
                className="surface-subtle block p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{new Date(observation.observedAt).toLocaleString("zh-CN")}</span>
                  <span>·</span>
                  <span>{observation.locationName}</span>
                  {observation.habitat ? (
                    <>
                      <span>·</span>
                      <span>{observation.habitat}</span>
                    </>
                  ) : null}
                </div>

                {observation.species.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {observation.species.map((item) => (
                      <span
                        key={`${observation.id}-${item.speciesId}`}
                        className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {item.commonName}
                        {item.count ? ` × ${item.count}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}

                {observation.notes ? (
                  <p className="mt-4 text-sm leading-6 text-foreground/90">{observation.notes}</p>
                ) : null}
              </Link>
            ))}
          </div>

          {observations.length === 0 ? (
            <div className="surface-subtle mt-6 px-6 py-12 text-center text-muted-foreground">
              暂无可展示的观察记录。
            </div>
          ) : null}

          <div className="mt-8 flex justify-end">
            {hasMore ? (
              <Link
                href={`/explore/observations?page=${page + 1}`}
                className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70"
              >
                下一页
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

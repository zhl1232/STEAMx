import Link from "next/link";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesList } from "@/lib/api/nature-observation-data";

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const query = params.q || undefined;
  const { species, hasMore } = await getSpeciesList({ query, page, pageSize: 12 });

  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="鸟类物种" fallbackHref="/explore" />
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <p className="section-kicker">自然观察</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">鸟类物种</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            浏览当前可观察的鸟类物种，了解识别特征、常见环境和观察建议。
          </p>

          <form className="mt-6" action="/explore/species" method="get">
            <div className="segmented-control flex w-full gap-2 rounded-[24px] p-2">
              <input
                type="text"
                name="q"
                defaultValue={query || ""}
                placeholder="搜索物种名称、学名或类群"
                className="h-11 flex-1 rounded-2xl border border-border/70 bg-background/85 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                搜索
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {species.map((item) => (
              <Link
                key={item.id}
                href={`/explore/species/${item.slug}`}
                className="surface-subtle p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{item.commonName}</h2>
                    {item.scientificName ? (
                      <p className="mt-1 text-sm italic text-muted-foreground">{item.scientificName}</p>
                    ) : null}
                  </div>
                  {item.taxonGroup ? (
                    <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {item.taxonGroup}
                    </span>
                  ) : null}
                </div>

                {item.habitatNotes ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.habitatNotes}</p>
                ) : null}

                {item.seasonalityNotes ? (
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    北京时段：{item.seasonalityNotes}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>

          {species.length === 0 ? (
            <div className="surface-subtle mt-6 px-6 py-12 text-center text-muted-foreground">
              暂无可展示的物种数据。
            </div>
          ) : null}

          <div className="mt-8 flex justify-end">
            {hasMore ? (
              <Link
                href={`/explore/species?page=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
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

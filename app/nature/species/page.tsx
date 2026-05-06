import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SpeciesListLoadMore } from "./species-list-load-more";

const SPECIES_PAGE_SIZE = 12;

export const metadata: Metadata = buildPageMetadata({
  title: "物种档案",
  description: "浏览自然观察频道中的物种档案，查看常见名称、学名、识别特征、常见环境以及最近观察线索。",
  path: "/nature/species",
  keywords: ["物种档案", "鸟类图鉴", "物种识别", "学名查询"],
});

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const query = params.q || undefined;
  const fromHref = (() => {
    const queryParams = new URLSearchParams();
    if (query) queryParams.set("q", query);
    if (page > 0) queryParams.set("page", String(page));
    const serialized = queryParams.toString();
    return serialized ? `/nature/species?${serialized}` : "/nature/species";
  })();
  const { species, hasMore, total } = await getSpeciesList({
    query,
    page,
    pageSize: SPECIES_PAGE_SIZE,
  });

  return (
    <div className="page-shell pb-24 pt-0 md:pb-10 md:pt-6">
      <MobilePageHeader
        title="物种"
        fallbackHref="/nature"
        className="-mx-4 mb-4 md:hidden"
      />

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="surface-subtle p-5 sm:p-6">
            <div className="relative">
              <p className="section-kicker">自然观察</p>
              <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-4xl">物种档案</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                浏览自然观察频道中的物种档案，了解识别特征、常见环境和最近观察线索。
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                已观察过的物种会带有标记，并在列表中靠后展示。
              </p>
              {total > 0 ? (
                <p className="mt-4 text-xs font-medium tabular-nums text-muted-foreground">
                  目录中共 <span className="text-foreground">{total.toLocaleString()}</span> 个物种
                  {query ? <span className="text-primary/90"> · 已按关键词筛选</span> : null}
                </p>
              ) : null}

              <form className="mt-6" action="/nature/species" method="get">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="segmented-control flex w-full min-w-0 flex-1 gap-2 rounded-[24px] p-2">
                    <input
                      type="text"
                      name="q"
                      defaultValue={query || ""}
                      placeholder="搜索物种名称、学名或科属"
                      className="h-11 min-w-0 flex-1 rounded-2xl border border-border/70 bg-background/90 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                      搜索
                    </button>
                  </div>
                  {query ? (
                    <Link
                      href="/nature/species"
                      className="shrink-0 text-center text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline sm:px-2"
                    >
                      清除筛选
                    </Link>
                  ) : null}
                </div>
              </form>
            </div>
          </div>

          {species.length > 0 ? (
            <SpeciesListLoadMore
              key={`${query ?? ""}-${page}`}
              initialSpecies={species}
            initialPage={page}
            pageSize={SPECIES_PAGE_SIZE}
            query={query}
            initialHasMore={hasMore}
            total={total}
            fromHref={fromHref}
          />
          ) : null}

          {species.length === 0 ? (
            <div className="surface-subtle mt-8 flex flex-col items-center gap-4 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground">
                <Search className="h-6 w-6" aria-hidden />
              </div>
              <div className="max-w-md space-y-2">
                <p className="text-base font-medium text-foreground">
                  {query ? "没有找到匹配的物种" : "暂无可展示的物种"}
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  {query
                    ? `试试缩短或更换关键词。当前搜索：「${query}」`
                    : "物种数据上线后会自动出现在这里。"}
                </p>
              </div>
              {query ? (
                <Link
                  href="/nature/species"
                  className="inline-flex items-center rounded-full border border-border/80 bg-background/90 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70"
                >
                  查看全部物种
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

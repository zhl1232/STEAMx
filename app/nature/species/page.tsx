import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { normalizeSpeciesTopicFilter } from "@/lib/utils/nature-topic-classification";
import { SpeciesListLoadMore } from "./species-list-load-more";

const SPECIES_PAGE_SIZE = 12;

export const metadata: Metadata = buildPageMetadata({
  title: "物种档案",
  description: "浏览自然观察频道中的物种档案，查看常见名称、学名、识别特征、常见环境以及最近观察线索。",
  path: "/nature/species",
  keywords: ["物种档案", "鸟类图鉴", "物种识别", "学名查询"],
});

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string; topic?: string }>;
}

function buildSpeciesHref({
  query,
  topic,
}: {
  query?: string;
  topic?: string;
}) {
  const queryParams = new URLSearchParams();
  if (query) queryParams.set("q", query);
  if (topic && topic !== "all") queryParams.set("topic", topic);
  const serialized = queryParams.toString();
  return serialized ? `/nature/species?${serialized}` : "/nature/species";
}

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const query = params.q || undefined;
  const topic = normalizeSpeciesTopicFilter(params.topic);
  const fromHref = (() => {
    const queryParams = new URLSearchParams();
    if (query) queryParams.set("q", query);
    if (topic !== "all") queryParams.set("topic", topic);
    if (page > 0) queryParams.set("page", String(page));
    const serialized = queryParams.toString();
    return serialized ? `/nature/species?${serialized}` : "/nature/species";
  })();
  const { species, hasMore, total, topicCounts } = await getSpeciesList({
    query,
    topic,
    page,
    pageSize: SPECIES_PAGE_SIZE,
  });
  const activeTopicCount = topicCounts.find((item) => item.key === topic);
  const activeTopicLabel = activeTopicCount?.label ?? "全部";

  return (
    <div className="app-shell-wide pb-24 pt-0 min-[390px]:px-5 md:px-8 md:pb-10 md:pt-8">
      <MobilePageHeader
        title="物种"
        fallbackHref="/nature"
        className="-mx-4 mb-4 min-[390px]:-mx-5 md:hidden"
      />

      <section className="surface-panel relative min-h-[300px] overflow-hidden">
        <Image
          src="/assets/species-archive-blue-tech-bg.png"
          alt=""
          fill
          priority
          className="object-cover opacity-44 dark:opacity-24"
          sizes="(min-width: 1840px) 1776px, (min-width: 768px) calc(100vw - 4rem), 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/96 via-background/84 to-background/38" />

        <div className="relative grid min-h-[300px] gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,540px)] lg:items-end lg:px-8">
          <div className="min-w-0">
            <p className="section-kicker">自然观察</p>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-5xl">物种档案</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              浏览自然观察频道中的物种档案，了解识别特征、常见环境和最近观察线索。
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">
              已观察过的物种会带有标记，并在列表中靠后展示。
            </p>
            {total > 0 ? (
              <p className="mt-4 text-xs font-medium tabular-nums text-muted-foreground">
                {topic === "all" ? "目录中共" : `${activeTopicLabel}中共`}{" "}
                <span className="text-foreground">{total.toLocaleString()}</span> 个物种
                {query ? <span className="text-primary/90"> · 已按关键词筛选</span> : null}
              </p>
            ) : null}
          </div>

          <form className="w-full" action="/nature/species" method="get">
            <div className="rounded-[18px] border border-border/70 bg-background/84 p-2 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
              <div className="flex min-w-0 gap-2">
                {topic !== "all" ? <input type="hidden" name="topic" value={topic} /> : null}
                <input
                  type="text"
                  name="q"
                  defaultValue={query || ""}
                  placeholder="搜索物种名称、学名或科属"
                  className="h-11 min-w-0 flex-1 rounded-[12px] border border-border/70 bg-background/90 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[12px] bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  搜索
                </button>
              </div>
              {query ? (
                <Link
                  href={buildSpeciesHref({ topic })}
                  className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
                >
                  清除筛选
                </Link>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2" aria-label="物种分类筛选">
                {topicCounts.map((item) => {
                  const active = item.key === topic;
                  return (
                    <Link
                      key={item.key}
                      href={buildSpeciesHref({ query, topic: item.key })}
                      className={
                        active
                          ? "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)]"
                          : "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/78 transition-colors hover:border-primary/35 hover:bg-muted/60"
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{item.label}</span>
                      <span className={active ? "text-background/72" : "text-muted-foreground"}>
                        {item.count.toLocaleString()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      </section>

      {species.length > 0 ? (
        <SpeciesListLoadMore
          key={`${query ?? ""}-${topic}-${page}`}
          initialSpecies={species}
          initialPage={page}
          pageSize={SPECIES_PAGE_SIZE}
          query={query}
          topic={topic}
          initialHasMore={hasMore}
          total={total}
          fromHref={fromHref}
        />
      ) : null}

      {species.length === 0 ? (
        <div className="surface-panel mt-6 flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground">
            <Search className="h-6 w-6" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-medium text-foreground">
              {query ? "没有找到匹配的物种" : topic !== "all" ? "这个分类暂时还没有可展示的物种" : "暂无可展示的物种"}
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {query
                ? `试试缩短或更换关键词。当前搜索：「${query}」`
                : topic !== "all"
                  ? `${activeTopicLabel}物种数据上线后会自动出现在这里。`
                : "物种数据上线后会自动出现在这里。"}
            </p>
          </div>
          {query ? (
            <Link
              href={buildSpeciesHref({ topic })}
              className="inline-flex items-center rounded-full border border-border/80 bg-background/90 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              查看全部物种
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

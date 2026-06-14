"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Feather, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Species } from "@/lib/mappers/types";
import type { SpeciesObservationStatusFilter } from "@/lib/observations/progress";
import { resolveAssetDisplayUrl, shouldBypassAssetDisplayOptimization } from "@/lib/utils/asset-url";
import type { SpeciesTopicFilter } from "@/lib/utils/nature-topic-classification";
import { appendNatureFrom } from "@/lib/utils/nature-navigation";
import { splitTaxonGroup, toSpeciesPinyinLabel } from "@/lib/utils/species-pinyin";

interface SpeciesListLoadMoreProps {
  initialSpecies: Species[];
  initialPage: number;
  pageSize: number;
  query?: string;
  topic?: SpeciesTopicFilter;
  status?: SpeciesObservationStatusFilter;
  initialHasMore: boolean;
  total: number;
  fromHref?: string;
}

export function SpeciesListLoadMore({
  initialSpecies,
  initialPage,
  pageSize,
  query,
  topic = "all",
  status = "all",
  initialHasMore,
  total,
  fromHref,
}: SpeciesListLoadMoreProps) {
  const [items, setItems] = useState(initialSpecies);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page + 1));
      p.set("pageSize", String(pageSize));
      if (query) p.set("q", query);
      if (topic !== "all") p.set("topic", topic);
      if (status !== "all") p.set("status", status);
      const res = await fetch(`/api/species?${p.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { species: Species[]; hasMore: boolean };
      setItems((prev) => [...prev, ...data.species]);
      setPage((prev) => prev + 1);
      setHasMore(data.hasMore);
    } catch {
      // 静默失败；按钮可重试
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page, pageSize, query, topic, status]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetchingRef.current) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const shown = items.length;

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {items.map((item, index) => {
          const commonNamePinyin = toSpeciesPinyinLabel(item.commonName);
          const { family, genus } = splitTaxonGroup(item.taxonGroup);
          const familyPinyin = toSpeciesPinyinLabel(family);
          const genusPinyin = toSpeciesPinyinLabel(genus);
          const staggerMs = Math.min(index, 10) * 40;
          const coverImageSrc = resolveAssetDisplayUrl(item.coverImageUrl) ?? item.coverImageUrl;

          return (
            <Link
              key={item.id}
              href={appendNatureFrom(`/nature/species/${item.slug}`, fromHref)}
              className="nature-species-card group motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500 hover:-translate-y-0.5"
              style={{ animationDelay: `${staggerMs}ms` }}
            >
              <div className="nature-species-card-media">
                {coverImageSrc ? (
                  <Image
                    src={coverImageSrc}
                    alt={item.commonName}
                    fill
                    sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    quality={60}
                    unoptimized={shouldBypassAssetDisplayOptimization(item.coverImageUrl)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[hsl(var(--primary)/0.78)]">
                    <Feather className="h-10 w-10" />
                  </div>
                )}
              </div>

              <div className="space-y-2.5 p-3.5">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    {commonNamePinyin ? (
                      <p className="text-[11px] leading-none tracking-[0.08em] text-[hsl(var(--primary)/0.82)]">{commonNamePinyin}</p>
                    ) : (
                      <div />
                    )}
                    <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground/60 transition-colors duration-300 group-hover:text-[hsl(var(--primary)/0.85)]">
                      {!item.observedByCurrentUser ? (
                        <span className="text-[11px] font-semibold">查看线索</span>
                      ) : null}
                      <ChevronRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{item.commonName}</h2>
                    {item.observedByCurrentUser ? (
                      <span className="nature-species-badge nature-species-badge-observed">
                        已观察
                      </span>
                    ) : (
                      <span className="nature-species-badge nature-species-badge-unobserved">
                        待观察
                      </span>
                    )}
                    <span className="nature-species-badge nature-species-badge-topic">
                      {item.topicLabel ?? "未分类"}
                    </span>
                  </div>
                </div>

                {family || genus ? (
                  <div className="nature-species-taxonomy">
                    {family ? (
                      <div className="nature-species-taxonomy-cell min-w-0 flex-1">
                        {familyPinyin ? (
                          <p className="truncate text-[10px] leading-none text-[hsl(var(--primary)/0.76)]">{familyPinyin}</p>
                        ) : null}
                        <p className="mt-0.5 truncate text-sm text-muted-foreground" title={family}>
                          {family}
                        </p>
                      </div>
                    ) : null}
                    {genus ? (
                      <div className="nature-species-taxonomy-cell min-w-0 flex-1">
                        {genusPinyin ? (
                          <p className="truncate text-[10px] leading-none text-[hsl(var(--primary)/0.76)]">{genusPinyin}</p>
                        ) : null}
                        <p className="mt-0.5 truncate text-sm text-muted-foreground" title={genus}>
                          {genus}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {items.length > 0 ? (
        <div className="mt-8 space-y-4 border-t border-border/60 pt-6">
          <p className="text-xs tabular-nums text-muted-foreground">
            已展示 <span className="font-medium text-foreground">{shown}</span>
            {total > 0 ? (
              <>
                {" "}
                / {total.toLocaleString()} 条
              </>
            ) : null}
          </p>

          {hasMore ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loading}
                className="gap-2 border-[hsl(var(--surface-border)/0.3)] bg-[hsl(var(--surface-raised)/0.86)] px-5 font-semibold hover:bg-[hsl(var(--status-info-surface)/0.58)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    加载中…
                  </>
                ) : (
                  "加载更多"
                )}
              </Button>
              <div ref={sentinelRef} className="h-px w-full max-w-[200px] shrink-0" aria-hidden />
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">已加载全部物种</p>
          )}
        </div>
      ) : null}
    </>
  );
}

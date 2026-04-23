"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Feather, Loader2 } from "lucide-react";

import type { Species } from "@/lib/mappers/types";
import { splitTaxonGroup, toSpeciesPinyinLabel } from "@/lib/utils/species-pinyin";

interface SpeciesListLoadMoreProps {
  initialSpecies: Species[];
  initialPage: number;
  pageSize: number;
  query?: string;
  initialHasMore: boolean;
  total: number;
}

export function SpeciesListLoadMore({
  initialSpecies,
  initialPage,
  pageSize,
  query,
  initialHasMore,
  total,
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
  }, [hasMore, page, pageSize, query]);

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
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const commonNamePinyin = toSpeciesPinyinLabel(item.commonName);
          const { family, genus } = splitTaxonGroup(item.taxonGroup);
          const familyPinyin = toSpeciesPinyinLabel(family);
          const genusPinyin = toSpeciesPinyinLabel(genus);
          const staggerMs = Math.min(index, 10) * 40;

          return (
            <Link
              key={item.id}
              href={`/nature/species/${item.slug}`}
              className="group motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500 overflow-hidden rounded-[24px] border border-border/70 bg-card/85 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)] transition-all motion-reduce:animate-none motion-reduce:opacity-100 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)]"
              style={{ animationDelay: `${staggerMs}ms` }}
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.22),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.2),transparent_40%),linear-gradient(160deg,rgba(248,250,252,0.95),rgba(238,242,255,0.85))] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.18),transparent_40%),linear-gradient(160deg,rgba(9,14,22,0.96),rgba(14,24,32,0.9))]">
                {item.coverImageUrl ? (
                  <Image
                    src={item.coverImageUrl}
                    alt={item.commonName}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    quality={60}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-emerald-700/80 dark:text-emerald-300/80">
                    <Feather className="h-10 w-10" />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.commonName}</h2>
                      {item.observedByCurrentUser ? (
                        <span className="inline-flex rounded-full border border-emerald-300/80 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                          已观察
                        </span>
                      ) : null}
                    </div>
                    {commonNamePinyin ? (
                      <p className="mt-1 text-xs tracking-[0.08em] text-primary/80">{commonNamePinyin}</p>
                    ) : null}
                    {item.scientificName ? (
                      <p className="mt-2 font-heading text-sm italic leading-snug text-muted-foreground">
                        {item.scientificName}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="mt-1 h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary/70"
                    aria-hidden
                  />
                </div>

                {family || genus ? (
                  <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-border/70 bg-background/70">
                    {family ? (
                      <div className="min-w-0 flex-1 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">科</p>
                        <p className="mt-0.5 truncate text-sm font-medium" title={family}>
                          {family}
                        </p>
                        {familyPinyin ? (
                          <p className="mt-0.5 truncate text-[11px] text-primary/75">{familyPinyin}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {family && genus ? <div className="w-px shrink-0 bg-border/60" aria-hidden /> : null}
                    {genus ? (
                      <div className="min-w-0 flex-1 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">属</p>
                        <p className="mt-0.5 truncate text-sm font-medium" title={genus}>
                          {genus}
                        </p>
                        {genusPinyin ? (
                          <p className="mt-0.5 truncate text-[11px] text-primary/75">{genusPinyin}</p>
                        ) : null}
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
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/80 bg-background/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    加载中…
                  </>
                ) : (
                  "加载更多"
                )}
              </button>
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

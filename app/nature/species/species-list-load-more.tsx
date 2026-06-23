"use client";

import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Feather, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Species } from "@/lib/mappers/types";
import {
  type CachedNatureSpeciesListState,
  natureSpeciesListStateQueryKey,
  natureSpeciesPageQueryOptions,
} from "@/lib/nature-species-queries";
import {
  buildNatureSpeciesFiltersKey,
  clearNatureSpeciesScrollRestore,
  getNatureSpeciesNextPageForAnchor,
  readNatureSpeciesScrollRestore,
  saveNatureSpeciesScrollRestore,
} from "@/lib/nature-species-scroll-restore";
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
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);
  const isRestoringScrollRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const serverState = useMemo<CachedNatureSpeciesListState>(
    () => ({
      items: initialSpecies,
      page: initialPage,
      hasMore: initialHasMore,
      total,
    }),
    [initialHasMore, initialPage, initialSpecies, total],
  );

  const queryInput = useMemo(
    () => ({
      query,
      topic,
      status,
      pageSize,
    }),
    [pageSize, query, status, topic],
  );
  const listStateKey = useMemo(() => natureSpeciesListStateQueryKey(queryInput), [queryInput]);

  const [items, setItems] = useState(serverState.items);
  const [page, setPage] = useState(serverState.page);
  const [hasMore, setHasMore] = useState(serverState.hasMore);
  const pageRef = useRef(serverState.page);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (queryInput.query) params.set("q", queryInput.query);
    if (queryInput.topic !== "all") params.set("topic", queryInput.topic);
    if (queryInput.status !== "all") params.set("status", queryInput.status);
    return params;
  }, [queryInput]);

  const fetchSpeciesPage = useCallback(
    (pageNum: number) =>
      queryClient.fetchQuery(
        natureSpeciesPageQueryOptions({
          ...queryInput,
          page: pageNum,
        }),
      ),
    [queryClient, queryInput],
  );

  const mergeUniqueSpeciesById = useCallback((existing: Species[], incoming: Species[]) => {
    if (incoming.length === 0) return existing;

    const seen = new Set(existing.map((item) => item.id));
    const appended: Species[] = [];

    for (const item of incoming) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      appended.push(item);
    }

    return appended.length > 0 ? [...existing, ...appended] : existing;
  }, []);

  // 用 ref 持有最新回调引用，供 mount-only 的 useLayoutEffect 使用，避免陈旧闭包。
  const buildFilterParamsRef = useRef(buildFilterParams);
  const fetchSpeciesPageRef = useRef(fetchSpeciesPage);
  buildFilterParamsRef.current = buildFilterParams;
  fetchSpeciesPageRef.current = fetchSpeciesPage;

  const saveScrollPosition = useCallback((anchorElement?: HTMLElement | null, anchorSlug?: string, anchorIndex?: number) => {
    if (typeof window === "undefined") return;
    const anchorTop = anchorElement?.getBoundingClientRect().top;
    const nextPageForAnchor = getNatureSpeciesNextPageForAnchor(anchorIndex, pageSize);

    saveNatureSpeciesScrollRestore({
      filtersKey: buildNatureSpeciesFiltersKey(buildFilterParams()),
      scrollY: window.scrollY,
      nextPage: Math.max(pageRef.current + 1, nextPageForAnchor),
      anchorSlug,
      anchorTop,
      anchorIndex,
    });
  }, [buildFilterParams, pageSize]);

  const handleSpeciesLinkClick = useCallback((anchorElement?: HTMLElement | null, anchorSlug?: string, anchorIndex?: number) => {
    saveScrollPosition(anchorElement, anchorSlug, anchorIndex);
  }, [saveScrollPosition]);

  const loadMore = useCallback(async () => {
    if (isRestoringScrollRef.current || fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const nextPage = pageRef.current + 1;
      const data = await fetchSpeciesPage(nextPage);
      // 使用函数式更新避免闭包捕获陈旧 items
      setItems((prev) => mergeUniqueSpeciesById(prev, data.species));
      setPage(nextPage);
      pageRef.current = nextPage;
      setHasMore(data.hasMore);
      // queryClient 状态由下方 useEffect 统一同步，此处不再重复调用
    } catch {
      // 静默失败；按钮可重试
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchSpeciesPage, hasMore, mergeUniqueSpeciesById]);

  useEffect(() => {
    queryClient.setQueryData<CachedNatureSpeciesListState>(listStateKey, {
      items,
      page,
      hasMore,
      total,
    });
  }, [hasMore, items, listStateKey, page, queryClient, total]);

  useLayoutEffect(() => {
    const saved = readNatureSpeciesScrollRestore();
    if (!saved) return;

    const filtersKey = buildNatureSpeciesFiltersKey(buildFilterParamsRef.current());
    if (saved.filtersKey !== filtersKey) {
      clearNatureSpeciesScrollRestore();
      return;
    }

    clearNatureSpeciesScrollRestore();
    isRestoringScrollRef.current = true;

    let cancelled = false;
    const cachedState = queryClient.getQueryData<CachedNatureSpeciesListState>(listStateKey);
    const targetLoadedPage = Math.max(initialPage, saved.nextPage - 1);

    const restoreScroll = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          const anchorElement = saved.anchorSlug
            ? document.querySelector<HTMLElement>(`[data-species-slug="${CSS.escape(saved.anchorSlug)}"]`)
            : null;
          const nextScrollY = anchorElement && typeof saved.anchorTop === "number"
            ? window.scrollY + anchorElement.getBoundingClientRect().top - saved.anchorTop
            : saved.scrollY;
          window.scrollTo({ top: Math.max(0, nextScrollY), left: 0, behavior: "auto" });
          isRestoringScrollRef.current = false;
        });
      });
    };

    const syncRestoredSpecies = (nextItems: Species[], nextHasMore: boolean, nextPage: number) => {
      if (cancelled) return;
      setItems(nextItems);
      setHasMore(nextHasMore);
      setPage(nextPage);
      pageRef.current = nextPage;
      restoreScroll();
    };

    if (cachedState && cachedState.page >= targetLoadedPage) {
      syncRestoredSpecies(cachedState.items, cachedState.hasMore, cachedState.page);
      return () => {
        cancelled = true;
        isRestoringScrollRef.current = false;
      };
    }

    if (saved.nextPage <= initialPage + 1) {
      syncRestoredSpecies(serverState.items, serverState.hasMore, serverState.page);
      return () => {
        cancelled = true;
        isRestoringScrollRef.current = false;
      };
    }

    void (async () => {
      const baseState =
        cachedState && cachedState.page >= serverState.page
          ? cachedState
          : serverState;
      let mergedSpecies = [...baseState.items];
      let nextHasMore = baseState.hasMore;
      let restoredPage = baseState.page;

      for (let pageNum = restoredPage + 1; pageNum <= targetLoadedPage; pageNum += 1) {
        if (cancelled) return;

        try {
          const data = await fetchSpeciesPageRef.current(pageNum);
          mergedSpecies = mergeUniqueSpeciesById(mergedSpecies, data.species ?? []);
          nextHasMore = data.hasMore ?? false;
          restoredPage = pageNum;
        } catch {
          break;
        }
      }

      syncRestoredSpecies(mergedSpecies, nextHasMore, restoredPage);
    })();

    return () => {
      cancelled = true;
      isRestoringScrollRef.current = false;
    };
    // 仅在组件挂载时执行一次，从 sessionStorage 读取恢复点。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              data-species-slug={item.slug}
              onPointerDown={(event) => handleSpeciesLinkClick(event.currentTarget, item.slug, index)}
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

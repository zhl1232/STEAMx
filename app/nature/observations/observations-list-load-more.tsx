"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { ObservationCard } from "@/components/features/bird-observation/observation-card";
import { Button } from "@/components/ui/button";
import type { ObservationEvent } from "@/lib/mappers/types";

interface ObservationsListLoadMoreProps {
  initialObservations: ObservationEvent[];
  initialPage: number;
  pageSize: number;
  initialHasMore: boolean;
  total: number;
  fromHref?: string;
}

export function ObservationsListLoadMore({
  initialObservations,
  initialPage,
  pageSize,
  initialHasMore,
  total,
  fromHref,
}: ObservationsListLoadMoreProps) {
  const [items, setItems] = useState(initialObservations);
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
      const params = new URLSearchParams();
      params.set("page", String(page + 1));
      params.set("pageSize", String(pageSize));
      const response = await fetch(`/api/observations?${params.toString()}`);
      if (!response.ok) throw new Error("fetch failed");
      const data = (await response.json()) as {
        observations: ObservationEvent[];
        hasMore: boolean;
      };
      setItems((previous) => [...previous, ...data.observations]);
      setPage((previous) => previous + 1);
      setHasMore(data.hasMore);
    } catch {
      // 静默失败，允许用户手动重试
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetchingRef.current) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "180px 0px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((observation) => (
          <ObservationCard key={observation.id} observation={observation} fromHref={fromHref} />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="surface-subtle mt-6 px-6 py-12 text-center text-muted-foreground">
          暂无可展示的观察记录。
        </div>
      ) : (
        <div className="mt-8 space-y-4 border-t border-border/60 pt-6">
          <p className="text-xs tabular-nums text-muted-foreground">
            已展示 <span className="font-medium text-foreground">{items.length}</span>
            {total > 0 ? <> / {total.toLocaleString()} 条</> : null}
          </p>
          {hasMore ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loading}
                className="gap-2 border-border/80 bg-background/80 px-5 font-medium hover:bg-muted/70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    加载中...
                  </>
                ) : (
                  "加载更多"
                )}
              </Button>
              <div ref={sentinelRef} className="h-px w-full max-w-[220px]" aria-hidden />
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">已加载全部观察记录</p>
          )}
        </div>
      )}
    </>
  );
}

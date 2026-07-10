"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Repeat2 } from "lucide-react";

import { WorkCardGrid } from "@/components/features/works/work-card-grid";
import type { Work } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

type WorksBatch = {
  works: Work[];
  nextOffset: number;
  hasMore: boolean;
};

const HOME_WORKS_LIMIT = 4;

async function requestWorks(offset: number): Promise<WorksBatch> {
  const response = await fetch(`/api/explore/works?limit=${HOME_WORKS_LIMIT}&offset=${offset}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to fetch works");
  return response.json() as Promise<WorksBatch>;
}

export function HomeWorksSection({ initialData }: { initialData: WorksBatch }) {
  const [works, setWorks] = useState(initialData.works);
  const [nextOffset, setNextOffset] = useState(initialData.nextOffset);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [loadError, setLoadError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canRotate = hasMore || nextOffset > works.length;

  const handleRotate = () => {
    startTransition(() => {
      void (async () => {
        try {
          setLoadError(false);
          const next = await requestWorks(hasMore ? nextOffset : 0);
          setWorks(next.works);
          setNextOffset(next.nextOffset);
          setHasMore(next.hasMore);
        } catch {
          setLoadError(true);
        }
      })();
    });
  };

  return (
    <section className="min-w-0" aria-labelledby="home-works-heading">
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <div>
          <p className="hidden text-[11px] font-bold text-[hsl(var(--brand-blue))] md:block">社区正在创作</p>
          <h2 id="home-works-heading" className="text-[17px] font-extrabold text-foreground md:mt-1 md:text-[20px]">
            大家的新作品
          </h2>
        </div>
        {works.length > 0 && canRotate ? (
          <button
            type="button"
            onClick={handleRotate}
            disabled={isPending}
            title="换一批作品"
            className="inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[13px] font-semibold text-[hsl(var(--brand-blue))] disabled:cursor-wait disabled:opacity-60"
          >
            <Repeat2 className={cn("h-4 w-4", isPending && "animate-spin")} />
            换一批
          </button>
        ) : null}
      </div>
      {works.length > 0 ? (
        <WorkCardGrid works={works} className="md:grid-cols-2 xl:grid-cols-2" />
      ) : (
        <div className="grid min-h-[180px] place-items-center rounded-sm border border-dashed border-border bg-card/45 px-5 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">第一件新作品正在路上</p>
            <Link href="/explore" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[hsl(var(--brand-blue))]">
              找个项目开始创作
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
      {loadError ? <p className="mt-2 text-xs text-destructive">作品暂时无法更新，请稍后再试。</p> : null}
    </section>
  );
}

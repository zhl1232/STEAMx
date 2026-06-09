"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ObservationEvent } from "@/lib/mappers/types";
import { formatObservationDateKey } from "@/lib/observations/display";
import type { NaturalObservationProgressSummary } from "@/lib/observations/progress";

interface ProfileObservationsPanelProps {
  observations: ObservationEvent[];
  observationsTotal: number;
  uniqueSpeciesCount: number;
  naturalObservationProgress?: NaturalObservationProgressSummary | null;
  isLoading: boolean;
  isLoaded: boolean;
}

export function ProfileObservationsPanel({
  observations,
  observationsTotal,
  uniqueSpeciesCount,
  naturalObservationProgress,
  isLoading,
  isLoaded,
}: ProfileObservationsPanelProps) {
  if (isLoading || !isLoaded) {
    return (
      <div className="surface-panel col-span-full px-5 py-12 text-center text-sm text-muted-foreground">
        加载观察记录中...
      </div>
    );
  }

  if (observations.length === 0) {
    return (
      <div className="surface-panel col-span-full px-5 py-12 text-center">
        <h3 className="text-base font-semibold text-foreground">还没有观察记录</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          去自然观察频道提交第一条记录，把你的发现整理进个人主页。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/nature/submit">提交第一条观察</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/nature/species">查看物种探索清单</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="surface-panel col-span-full overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">自然观察进度</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              已通过审核的观察记录会点亮对应物种，未观察目标会同步到物种探索清单。
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/nature/species?status=unobserved">查看待观察物种</Link>
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(naturalObservationProgress?.topicProgress || []).slice(1).map((item) => (
            <Link
              key={item.topic}
              href={`/nature/species?topic=${item.topic}&status=unobserved`}
              className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-background/72 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                <span className="text-xs font-bold text-primary">{item.progressPercent}%</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${item.progressPercent}%` }} />
              </div>
              <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                还有 <span className="text-foreground">{item.unobservedCount.toLocaleString()}</span> 待观察
              </p>
            </Link>
          ))}
        </div>
        {naturalObservationProgress?.unobservedSpeciesPreview?.length ? (
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="text-sm font-semibold text-foreground">下一批可以观察</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {naturalObservationProgress.unobservedSpeciesPreview.slice(0, 6).map((species) => (
                <Link
                  key={species.id}
                  href={`/nature/species/${species.slug}`}
                  className="rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/35 hover:bg-muted/60"
                >
                  {species.commonName}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="col-span-full mt-6">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h3 className="text-base font-semibold text-foreground">最近观察记录</h3>
          <Link href="/nature/observations" className="text-sm font-medium text-primary hover:underline">
            查看全部
          </Link>
        </div>
      </div>

      {observations.map((observation) => (
        <Link
          key={observation.id}
          href={`/nature/observations/${observation.id}`}
          className="surface-panel block overflow-hidden rounded-[var(--radius-lg)] p-4 transition-transform hover:-translate-y-0.5"
        >
          {observation.mediaUrls[0] ? (
            <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-lg bg-muted">
              <Image
                src={observation.mediaUrls[0]}
                alt="观察照片"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
            </div>
          ) : null}

          {observation.species.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {observation.species.map((species) => (
                <span
                  key={species.speciesId}
                  className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {species.commonName}
                  {species.count ? ` ×${species.count}` : ""}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>发布于 {formatObservationDateKey(observation.createdAt)}</span>
            <span>·</span>
            <span className="truncate">{observation.locationName}</span>
          </div>

          <div className="mt-2">
            <span className="inline-flex rounded-full border border-border/70 bg-muted/35 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {observation.isPublic ? "公开" : "仅自己可见"}
            </span>
          </div>

          {observation.notes ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">{observation.notes}</p>
          ) : null}
        </Link>
      ))}
    </>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ObservationEvent } from "@/lib/mappers/types";
import { formatObservationDateKey } from "@/lib/observations/display";

interface ProfileObservationsPanelProps {
  observations: ObservationEvent[];
  observationsTotal: number;
  uniqueSpeciesCount: number;
  isLoading: boolean;
  isLoaded: boolean;
}

export function ProfileObservationsPanel({
  observations,
  observationsTotal,
  uniqueSpeciesCount,
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
        <Button asChild className="mt-6">
          <Link href="/nature/submit">提交第一条观察</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="col-span-full grid grid-cols-2 gap-4">
        <div className="surface-subtle p-5">
          <div className="text-3xl font-semibold text-foreground">{observationsTotal}</div>
          <div className="mt-1 text-sm text-muted-foreground">观察记录总数</div>
        </div>
        <div className="surface-subtle p-5">
          <div className="text-3xl font-semibold text-foreground">{uniqueSpeciesCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">已观察物种数</div>
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

"use client"

import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { ObservationEvent } from "@/lib/mappers/types"

interface ProfileObservationsPanelProps {
  observations: ObservationEvent[]
  observationsTotal: number
  uniqueSpeciesCount: number
  isLoading: boolean
  isLoaded: boolean
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
      <div className="col-span-full text-center py-16 text-muted-foreground">加载中...</div>
    )
  }

  return (
    <>
      {observations.length > 0 && (
        <div className="col-span-full mb-2 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-emerald-50/60 p-5 dark:bg-emerald-950/10">
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{observationsTotal}</div>
            <div className="mt-1 text-sm text-muted-foreground">观察记录总数</div>
          </div>
          <div className="rounded-2xl border bg-sky-50/60 p-5 dark:bg-sky-950/10">
            <div className="text-3xl font-bold text-sky-700 dark:text-sky-300">{uniqueSpeciesCount}</div>
            <div className="mt-1 text-sm text-muted-foreground">已观察物种数</div>
          </div>
        </div>
      )}

      {observations.length === 0 && (
        <div className="col-span-full text-center py-16 text-muted-foreground">
          <p className="mb-4">你还没有提交任何观察记录</p>
          <Link href="/bird-observation/submit">
            <Button>提交第一条观察</Button>
          </Link>
        </div>
      )}

      {observations.length > 0 &&
        observations.map((obs) => (
          <Link
            key={obs.id}
            href={`/explore/observations/${obs.id}`}
            className="block rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {obs.mediaUrls[0] && (
              <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                <Image
                  src={obs.mediaUrls[0]}
                  alt="观察照片"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            )}
            {obs.species.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {obs.species.map((sp) => (
                  <span
                    key={sp.speciesId}
                    className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                  >
                    {sp.commonName}
                    {sp.count ? ` ×${sp.count}` : ""}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(obs.observedAt).toLocaleDateString("zh-CN")}</span>
              <span>·</span>
              <span>{obs.locationName}</span>
            </div>
            {obs.notes && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{obs.notes}</p>}
          </Link>
        ))}
    </>
  )
}

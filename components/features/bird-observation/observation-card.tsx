"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Sprout } from "lucide-react";

import type { ObservationEvent } from "@/lib/mappers/types";
import { appendNatureFrom } from "@/lib/utils/nature-navigation";
import { cn } from "@/lib/utils";

interface ObservationCardProps {
  observation: ObservationEvent;
  className?: string;
  fromHref?: string;
}

export function ObservationCard({ observation, className, fromHref }: ObservationCardProps) {
  const heroImage = observation.mediaUrls[0];
  const title = observation.species[0]?.commonName ?? `观察记录 #${observation.id}`;
  const summary = observation.notes?.trim();
  const observedAtLabel = new Date(observation.observedAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Link
      href={appendNatureFrom(`/nature/observations/${observation.id}`, fromHref)}
      className={cn(
        "group overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card/90 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_46px_-28px_rgba(15,23,42,0.45)]",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border/60">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            quality={60}
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.2),transparent_42%),radial-gradient(circle_at_82%_8%,rgba(59,130,246,0.18),transparent_40%),linear-gradient(160deg,rgba(248,250,252,0.95),rgba(238,242,255,0.86))] p-4 dark:bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.16),transparent_44%),radial-gradient(circle_at_82%_8%,rgba(59,130,246,0.14),transparent_42%),linear-gradient(160deg,rgba(8,14,22,0.94),rgba(12,20,30,0.9))]">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sprout className="h-3.5 w-3.5" />
              暂无照片
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="line-clamp-1 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <span className={observation.identificationStatus === "community_confirmed"
            ? "shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            : "shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}>
            {observation.identificationStatus === "community_confirmed" ? "已确认" : "待鉴定"}
          </span>
        </div>

        {observation.species.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {observation.species.slice(0, 3).map((item) => (
              <span
                key={`${observation.id}-${item.speciesId}`}
                className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {item.commonName}
                {item.count ? ` × ${item.count}` : ""}
              </span>
            ))}
            {observation.species.length > 3 ? (
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                +{observation.species.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {observedAtLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {observation.locationName}
          </span>
        </div>

        {summary ? <p className="line-clamp-2 text-sm leading-6 text-foreground/85">{summary}</p> : null}
      </div>
    </Link>
  );
}

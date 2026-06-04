"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Flame, ImageOff, Repeat2, Star } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { ToneBadge, type CategoryTone } from "@/components/ui/tone-badge";
import { CATEGORY_META } from "@/lib/config/categories";
import { type HomepageRecommendationMode } from "@/lib/home/recommendations";
import { type Project } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

export type ExploreForYouRailState = {
  projects: Project[];
  mode: HomepageRecommendationMode;
  nextOffset: number;
  hasMore: boolean;
};

async function requestExploreForYou(args: {
  offset: number;
  mode: HomepageRecommendationMode;
}): Promise<ExploreForYouRailState> {
  const params = new URLSearchParams({
    offset: String(args.offset),
    mode: args.mode,
  });

  const response = await fetch(`/api/explore/recommendations?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch explore recommendations");
  }

  return response.json() as Promise<ExploreForYouRailState>;
}

function getCategoryTone(category?: string): CategoryTone {
  return CATEGORY_META[category || ""]?.tone ?? "science";
}

function ExploreRecommendationCard({
  project,
  priority,
}: {
  project: Project;
  priority: boolean;
}) {
  const imageSrc = typeof project.image === "string" ? project.image.trim() : "";
  const [imageError, setImageError] = useState(false);
  const difficultyStars = project.difficulty_stars
    ? Math.max(1, Math.min(6, project.difficulty_stars))
    : null;

  useEffect(() => {
    setImageError(false);
  }, [imageSrc]);

  return (
    <article className="group relative h-full overflow-hidden rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))] transition duration-300 hover:border-[hsl(var(--surface-border-strong))]">
      <Link
        href={`/project/${project.id}?from=explore-for-you`}
        className="absolute inset-0 z-10"
        aria-label={`查看项目：${project.title}`}
      />

      <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--surface-muted))]">
        {imageSrc && !imageError ? (
          <OptimizedImage
            src={imageSrc}
            alt={project.title}
            fill
            variant="card"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            priority={priority}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/60" />
          </div>
        )}
      </div>

      <div className="pointer-events-none flex min-h-[136px] flex-col gap-2.5 p-3.5">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-[15px] font-bold leading-5 text-foreground">
            {project.title}
          </h3>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {project.category ? (
                <ToneBadge tone={getCategoryTone(project.category)} className="shrink-0 rounded-xs px-1.5 py-0.5 text-[10px]">
                  {project.category}
                </ToneBadge>
              ) : null}
              {project.sub_category ? (
                <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
                  {project.sub_category}
                </span>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[hsl(var(--brand-amber))]">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {difficultyStars ? `${difficultyStars}星` : "精选"}
            </span>
          </div>
        </div>

        <p className="line-clamp-2 text-[11px] leading-[1.58] text-muted-foreground/82">
          {project.description || "适合边做边学的 STEAM 实践项目。"}
        </p>
      </div>
    </article>
  );
}

export function ExploreForYouRail({
  initialData,
  className,
}: {
  initialData: ExploreForYouRailState | null;
  className?: string;
}) {
  const [projects, setProjects] = useState(initialData?.projects ?? []);
  const [mode, setMode] = useState<HomepageRecommendationMode>(
    initialData?.mode ?? "popular-fallback",
  );
  const [nextOffset, setNextOffset] = useState(initialData?.nextOffset ?? 0);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const railScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialData) {
      setProjects([]);
      return;
    }

    setProjects(initialData.projects);
    setMode(initialData.mode);
    setNextOffset(initialData.nextOffset);
    setHasMore(initialData.hasMore);
    setLoadError(null);
  }, [initialData]);

  const handleRotate = useCallback(() => {
    startTransition(() => {
      void (async () => {
        try {
          setLoadError(null);

          const firstMode = hasMore ? mode : (initialData?.mode ?? "popular-fallback");
          const firstOffset = hasMore ? nextOffset : 0;
          let nextBatch = await requestExploreForYou({
            offset: firstOffset,
            mode: firstMode,
          });

          if (
            nextBatch.projects.length === 0 &&
            !(firstMode === (initialData?.mode ?? "popular-fallback") && firstOffset === 0)
          ) {
            nextBatch = await requestExploreForYou({
              offset: 0,
              mode: initialData?.mode ?? "popular-fallback",
            });
          }

          setProjects(nextBatch.projects);
          setMode(nextBatch.mode);
          setNextOffset(nextBatch.nextOffset);
          setHasMore(nextBatch.hasMore);

          requestAnimationFrame(() => {
            if (railScrollRef.current) {
              railScrollRef.current.scrollLeft = 0;
            }
          });
        } catch {
          setLoadError("换一批失败，请稍后再试");
        }
      })();
    });
  }, [hasMore, initialData?.mode, mode, nextOffset]);

  if (projects.length === 0) {
    return null;
  }

  return (
    <section className={className} aria-labelledby="explore-for-you-heading">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="explore-for-you-heading"
            className="flex items-center gap-1.5 text-sm font-bold text-foreground md:text-base"
          >
            <Flame className="h-4 w-4 shrink-0 text-[hsl(var(--brand-amber))]" aria-hidden />
            热门推荐
          </h2>
        </div>
        <button
          type="button"
          onClick={handleRotate}
          disabled={isPending}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[hsl(var(--brand-blue))] disabled:cursor-wait disabled:opacity-60 md:text-[13px]"
        >
          <Repeat2 className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
          换一批
        </button>
      </div>

      <div
        ref={railScrollRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1.5 md:mx-0 md:px-0"
      >
        {projects.map((project, index) => (
          <div
            key={project.id}
            className="w-[min(45.5vw,176px)] shrink-0 snap-start sm:w-[184px]"
          >
            <ExploreRecommendationCard
              project={project}
              priority={index < 2}
            />
          </div>
        ))}
      </div>

      {loadError ? <p className="mt-2 text-[12px] text-destructive">{loadError}</p> : null}
    </section>
  );
}

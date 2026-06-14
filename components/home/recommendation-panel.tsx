"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Repeat2, ThumbsUp } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Surface } from "@/components/ui/surface";
import { ToneBadge, type CategoryTone } from "@/components/ui/tone-badge";
import { type HomepageRecommendationMode, type HomepageRecommendationResult } from "@/lib/home/recommendations";
import { type Project } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 8;

function getCategoryTone(category?: string): CategoryTone {
  if (category === "技术") return "tech";
  if (category === "工程") return "engineering";
  if (category === "艺术") return "art";
  if (category === "数学") return "math";
  return "science";
}

function formatCount(value: number | undefined) {
  const next = value && value > 0 ? value : 0;
  return next >= 1000 ? `${(next / 1000).toFixed(next % 1000 === 0 ? 0 : 1)}k` : String(next);
}

async function requestRecommendations(args: {
  offset: number;
  mode: HomepageRecommendationMode;
  excludeProjectIds: Array<string | number>;
}): Promise<HomepageRecommendationResult> {
  const params = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    offset: String(args.offset),
    mode: args.mode,
  });

  if (args.excludeProjectIds.length > 0) {
    params.set("excludeIds", args.excludeProjectIds.map((projectId) => String(projectId)).join(","));
  }

  const response = await fetch(`/api/home/recommendations?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch homepage recommendations");
  }

  return response.json() as Promise<HomepageRecommendationResult>;
}

export function RecommendationPanel(props: {
  initialProjects: Project[];
  initialMode: HomepageRecommendationMode;
  initialNextOffset: number;
  initialHasMore: boolean;
  excludeProjectIds: Array<string | number>;
  className?: string;
}) {
  const [projects, setProjects] = useState(props.initialProjects);
  const [mode, setMode] = useState<HomepageRecommendationMode>(props.initialMode);
  const [nextOffset, setNextOffset] = useState(props.initialNextOffset);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRotate = () => {
    startTransition(() => {
      void (async () => {
        try {
          setLoadError(null);

          const firstMode = hasMore ? mode : props.initialMode;
          const firstOffset = hasMore ? nextOffset : 0;
          let nextBatch = await requestRecommendations({
            offset: firstOffset,
            mode: firstMode,
            excludeProjectIds: props.excludeProjectIds,
          });

          if (
            nextBatch.projects.length === 0 &&
            !(firstMode === props.initialMode && firstOffset === 0)
          ) {
            nextBatch = await requestRecommendations({
              offset: 0,
              mode: props.initialMode,
              excludeProjectIds: props.excludeProjectIds,
            });
          }

          setProjects(nextBatch.projects);
          setMode(nextBatch.mode);
          setNextOffset(nextBatch.nextOffset);
          setHasMore(nextBatch.hasMore);
        } catch {
          setLoadError("换一批失败，请稍后再试");
        }
      })();
    });
  };

  return (
    <Surface className={cn("flex h-full flex-col p-4", props.className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-foreground">个性推荐</h2>
        <button
          type="button"
          onClick={handleRotate}
          disabled={isPending}
          className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[13px] font-medium text-[hsl(var(--brand-blue))] disabled:cursor-wait disabled:opacity-60"
        >
          <Repeat2 className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
          换一批
        </button>
      </div>

      {projects.length > 0 ? (
        <div className="flex flex-1 flex-col gap-2.5">
          {projects.slice(0, 6).map((project) => {
            const tone = getCategoryTone(project.category);

            return (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="grid min-h-[58px] grid-cols-[68px_minmax(0,1fr)] items-center gap-3 rounded-sm p-1.5 transition hover:bg-[hsl(var(--surface-muted))] min-[1480px]:grid-cols-[76px_minmax(0,1fr)_auto]"
              >
                <div className="relative h-[50px] overflow-hidden rounded-xs bg-[hsl(var(--surface-muted))]">
                  <OptimizedImage src={project.image} alt={project.title} fill variant="thumbnail" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-foreground">{project.title}</h3>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">{project.author}</p>
                  <div className="mt-1.5 flex items-center gap-2 min-[1480px]:hidden">
                    <ToneBadge tone={tone} className="rounded-full px-1.5 py-0.5 font-medium">
                      {project.category || "科学"}
                    </ToneBadge>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {formatCount(project.likes)}
                    </span>
                  </div>
                </div>
                <div className="hidden flex-col items-end gap-1.5 min-[1480px]:flex">
                  <ToneBadge tone={tone} className="rounded-full px-1.5 py-0.5 font-medium">
                    {project.category || "科学"}
                  </ToneBadge>
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {formatCount(project.likes)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-[hsl(var(--surface-border))] px-4 py-6 text-center text-[13px] text-muted-foreground">
          暂无推荐内容
        </div>
      )}

      {loadError ? (
        <p className="mt-3 text-[12px] text-destructive">{loadError}</p>
      ) : null}
    </Surface>
  );
}

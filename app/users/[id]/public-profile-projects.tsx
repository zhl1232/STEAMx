"use client";

import { useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";

import { ProjectCard } from "@/components/features/project-card";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/mappers/types";

const PAGE_SIZE = 12;

export function PublicProfileProjects({
  userId,
  initialProjects,
  initialHasMore,
}: {
  userId: string;
  initialProjects: Project[];
  initialHasMore: boolean;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/users/${userId}?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      setProjects((prev) => [...prev, ...((payload?.projects as Project[]) || [])]);
      setHasMore(Boolean(payload?.hasMoreProjects));
      setPage((current) => current + 1);
    } catch {
      setLoadError("更多作品暂时无法加载，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="surface-panel px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-muted/60">
          <FolderOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">还没有公开项目</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          这个主页暂时没有展示已发布的项目内容。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-md px-5"
            onClick={() => void loadMore()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            加载更多作品
          </Button>
        </div>
      ) : null}
      {loadError ? (
        <p className="text-center text-sm text-destructive">{loadError}</p>
      ) : null}
    </div>
  );
}

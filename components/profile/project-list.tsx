"use client";

import Link from "next/link";
import { Heart, Settings } from "lucide-react";

import { DifficultyStars } from "@/components/ui/difficulty-stars";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/context/project-context";
import { Project } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: Project[];
  completionStatusMap?: Map<number | string, { status: string; rejectionReason?: string }>;
  emptyState: {
    title: string;
    desc: string;
    btnText: string;
    href: string;
    icon?: React.ReactNode;
  };
}

export function ProjectList({ projects, completionStatusMap, emptyState }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        desc={emptyState.desc}
        btnText={emptyState.btnText}
        href={emptyState.href}
      />
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const projectId = typeof project.id === "string" ? parseInt(project.id, 10) : project.id;
        const completionStatus = !Number.isNaN(projectId) ? completionStatusMap?.get(projectId) : undefined;

        return (
          <div key={project.id} className="relative">
            {completionStatus?.status === "pending" ? (
              <div className="absolute left-3 top-3 z-10">
                <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  作品待审核
                </span>
              </div>
            ) : null}
            {completionStatus?.status === "rejected" ? (
              <div className="absolute left-3 top-3 z-10">
                <span
                  className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                  title={completionStatus.rejectionReason}
                >
                  作品未通过
                </span>
              </div>
            ) : null}
            <MobileProjectItem project={project} />
          </div>
        );
      })}
    </div>
  );
}

function MobileProjectItem({ project }: { project: Project }) {
  const { isLiked, getLikesDelta } = useProjects();
  const liked = isLiked(project.id);
  const likesCount = project.likes + getLikesDelta(project.id);

  return (
    <Link
      href={`/project/${project.id}`}
      className="surface-panel flex gap-3 rounded-[24px] p-3 transition-transform hover:-translate-y-0.5"
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-muted">
        <OptimizedImage
          src={
            project.image ||
            "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop"
          }
          alt={project.title}
          fill
          variant="thumbnail"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div>
          <div className="flex items-center gap-2">
            {project.category ? (
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {project.category}
              </span>
            ) : null}
            {project.sub_category ? (
              <span className="truncate text-[11px] text-muted-foreground">{project.sub_category}</span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-1 text-base font-semibold">{project.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{project.description}</p>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-red-500 text-red-500")} />
            {likesCount}
          </span>
          {project.difficulty_stars ? <DifficultyStars stars={project.difficulty_stars} size="sm" /> : null}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  btnText,
  href,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  btnText: string;
  href: string;
}) {
  return (
    <div className="surface-panel px-5 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        {icon || <Settings className="h-8 w-8" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
      <Button asChild variant="outline" className="mt-6 rounded-full px-8">
        <Link href={href}>
          {btnText}
        </Link>
      </Button>
    </div>
  );
}

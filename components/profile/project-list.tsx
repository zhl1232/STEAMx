"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

import { ProjectCard } from "@/components/features/project-card";
import { Button } from "@/components/ui/button";
import { Project } from "@/lib/mappers/types";

interface ProjectListProps {
  projects: Project[];
  projectHref?: (projectId: Project["id"]) => string;
  completionStatusMap?: Map<number | string, { status: string; rejectionReason?: string }>;
  showProjectStatus?: boolean;
  emptyState: {
    title: string;
    desc: string;
    btnText: string;
    href: string;
    icon?: React.ReactNode;
  };
}

export function ProjectList({
  projects,
  projectHref,
  completionStatusMap,
  showProjectStatus = false,
  emptyState,
}: ProjectListProps) {
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
      {projects.map((project, index) => {
        const projectId = typeof project.id === "string" ? parseInt(project.id, 10) : project.id;
        const completionStatus = !Number.isNaN(projectId) ? completionStatusMap?.get(projectId) : undefined;

        return (
          <div
            key={project.id}
            className="relative"
            style={
              index >= 4
                ? { contentVisibility: "auto", containIntrinsicSize: "140px 420px" }
                : undefined
            }
          >
            {completionStatus?.status === "pending" ? (
              <div className="absolute left-3 top-3 z-10">
                <span className="inline-flex items-center rounded-full border border-[hsl(var(--brand-amber)/0.26)] bg-[hsl(var(--brand-amber)/0.14)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-amber))]">
                  作品待审核
                </span>
              </div>
            ) : null}
            {completionStatus?.status === "rejected" ? (
              <div className="absolute left-3 top-3 z-10">
                <span
                  className="inline-flex items-center rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                  title={completionStatus.rejectionReason}
                >
                  作品未通过
                </span>
              </div>
            ) : null}
            <ProjectCard
              project={project}
              href={projectHref ? projectHref(project.id) : undefined}
              showStatus={showProjectStatus}
              variant="compact"
              compactLayout="vertical"
            />
          </div>
        );
      })}
    </div>
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
    <div className="surface-subtle px-5 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground">
        {icon || <Settings className="h-8 w-8" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
      <Button asChild variant="outline" className="mt-6 px-8">
        <Link href={href}>
          {btnText}
        </Link>
      </Button>
    </div>
  );
}

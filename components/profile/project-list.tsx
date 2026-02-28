"use client";

import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Project } from "@/lib/mappers/types";
import { Button } from "@/components/ui/button";
import { Settings, Heart } from "lucide-react";
import { useProjects } from "@/context/project-context";
import { cn } from "@/lib/utils";
import { DifficultyStars } from "@/components/ui/difficulty-stars";

interface ProjectListProps {
    projects: Project[];
    emptyState: {
        title: string;
        desc: string;
        btnText: string;
        href: string;
        icon?: React.ReactNode;
    };
}

export function ProjectList({ projects, emptyState }: ProjectListProps) {
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
        <>
            {projects.map((p) => (
                <MobileProjectItem key={p.id} project={p} />
            ))}
        </>
    );
}

function MobileProjectItem({ project }: { project: Project }) {
    const { isLiked, getLikesDelta } = useProjects();
    const liked = isLiked(project.id);
    const likesCount = project.likes + getLikesDelta(project.id);

    return (
        <Link href={`/project/${project.id}`} className="flex gap-3 p-3 bg-card rounded-xl border shadow-sm transition-colors hover:bg-accent/5">
            <div className="w-24 h-24 shrink-0 bg-muted rounded-lg overflow-hidden relative">
                <OptimizedImage
                    src={project.image || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop'}
                    alt={project.title}
                    fill
                    variant="thumbnail"
                    className="object-cover"
                />
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                    <h3 className="font-bold line-clamp-1">{project.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{project.description}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                        <Heart className={cn("w-3.5 h-3.5", liked && "fill-red-500 text-red-500")} />
                        {likesCount}
                    </span>
                    {project.difficulty_stars ? (
                        <DifficultyStars stars={project.difficulty_stars} size="sm" />
                    ) : null}
                    {project.category && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] ml-auto border border-primary/20">
                            {project.category}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}

function EmptyState({ icon, title, desc, btnText, href }: {
    icon?: React.ReactNode;
    title: string;
    desc: string;
    btnText: string;
    href: string
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                {icon || <Settings className="h-8 w-8" />}
            </div>
            <h3 className="font-bold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{desc}</p>
            <Link href={href}>
                <Button variant="outline" className="rounded-full px-8">{btnText}</Button>
            </Link>
        </div>
    )
}

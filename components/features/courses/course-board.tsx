"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import type { CourseListItem } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

export function CourseBoard() {
    const [courses, setCourses] = useState<CourseListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/courses");
                if (!res.ok) throw new Error("加载失败");
                const data = await res.json();
                if (!cancelled) setCourses(data.courses ?? []);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "加载失败");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div className="grid gap-3 py-4 md:grid-cols-2 md:p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <ChallengeCardSkeleton key={i} className="!rounded-[var(--radius-sm)]" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                    重试
                </Button>
            </div>
        );
    }

    if (courses.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p>技能课程即将上线，敬请期待。</p>
            </div>
        );
    }

    return (
        <div className="grid gap-3 py-4 md:grid-cols-2 md:p-6">
            {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
            ))}
        </div>
    );
}

function CourseCard({ course }: { course: CourseListItem }) {
    const imageSrc = course.image_url || "/projects/tech_programming.webp";

    return (
        <article className="group community-challenge-card md:grid-cols-[132px_minmax(0,1fr)]">
            <Link
                href={`/courses/${course.id}`}
                className="absolute inset-0 z-10 rounded-[var(--radius-sm)]"
                aria-label={`进入技能课程：${course.title}`}
            />
            <div className="relative min-h-[102px] overflow-hidden rounded-[var(--radius-xs)] bg-[hsl(var(--status-info-surface))] md:min-h-[98px] md:rounded-[var(--radius-sm)]">
                <OptimizedImage
                    src={imageSrc}
                    alt={course.title}
                    fill
                    variant="thumbnail"
                    className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-[var(--radius-xs)] bg-[hsl(var(--brand-blue))] px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                    课程
                </span>
            </div>
            <div className="pointer-events-none relative z-0 flex min-w-0 flex-col justify-center py-1 pr-1">
                <h3 className="line-clamp-2 text-[15px] font-black leading-[1.45] text-foreground min-[390px]:text-[16px] md:min-h-[48px] md:text-[17px] md:leading-6">
                    {course.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[12px] leading-[1.65] text-muted-foreground min-[390px]:text-[13px] md:leading-5">
                    {course.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lesson_count} 课时
                    </span>
                    {course.tags?.includes("Scratch") ? (
                        <span className="rounded bg-[hsl(var(--tone-tech)/0.12)] px-1.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--tone-tech))]">
                            Scratch
                        </span>
                    ) : null}
                </div>
            </div>
            <span className="pointer-events-none absolute bottom-3 right-3 z-0 inline-flex items-center gap-0.5 text-[12px] font-bold text-[hsl(var(--brand-blue))] min-[560px]:hidden">
                开始学习
                <ChevronRight className="h-3.5 w-3.5" />
            </span>
            <span
                className={cn(
                    "pointer-events-none absolute bottom-3 right-3 z-0 hidden h-9 items-center gap-1 rounded-[var(--radius-sm)]",
                    "bg-[hsl(var(--brand-blue))] px-4 text-[13px] font-bold text-[hsl(var(--brand-blue-foreground))]",
                    "min-[560px]:inline-flex",
                )}
            >
                开始学习
                <ChevronRight className="h-4 w-4" />
            </span>
        </article>
    );
}

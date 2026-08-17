import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Circle, PlayCircle } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { CompactCardSkeleton } from "@/components/ui/loading-skeleton";
import type { CourseListItem } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

const BRICK_COURSE_TAGS = new Set(["积木", "乐高", "得宝", "building_3d"]);

export function isBrickCourse(course: Pick<CourseListItem, "tags">) {
    return (course.tags ?? []).some((tag) => BRICK_COURSE_TAGS.has(tag.trim().toLowerCase()));
}

export function partitionCourseGroups(courses: readonly CourseListItem[]) {
    return courses.reduce(
        (groups, course) => {
            groups[isBrickCourse(course) ? "brick" : "other"].push(course);
            return groups;
        },
        { brick: [] as CourseListItem[], other: [] as CourseListItem[] },
    );
}

export function CourseBoard({ courses }: { courses: CourseListItem[] }) {
    if (courses.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p>技能课程即将上线，敬请期待。</p>
            </div>
        );
    }

    const { brick, other } = partitionCourseGroups(courses);

    return (
        <div>
            {brick.length > 0 ? (
                <CourseSection
                    eyebrow="推荐起步"
                    title="积木搭建"
                    description="从一块积木开始，跟着 3D 分步完成一件看得见的作品。"
                    courses={brick}
                />
            ) : null}
            {other.length > 0 ? (
                <CourseSection
                    eyebrow={brick.length > 0 ? "继续探索" : "全部课程"}
                    title={brick.length > 0 ? "其他技能" : "技能课程"}
                    description={
                        brick.length > 0
                            ? "编程、棋类思维等课程，换一种方式继续动手和思考。"
                            : "按步骤学习一项技能，把练习变成自己的作品。"
                    }
                    courses={other}
                    separated={brick.length > 0}
                />
            ) : null}
        </div>
    );
}

function CourseSection({
    eyebrow,
    title,
    description,
    courses,
    separated = false,
}: {
    eyebrow: string;
    title: string;
    description: string;
    courses: CourseListItem[];
    separated?: boolean;
}) {
    const headingId = `course-section-${title}`;

    return (
        <section
            aria-labelledby={headingId}
            className={cn("px-2 py-5 md:px-6 md:py-6", separated && "border-t border-[hsl(var(--surface-border)/0.72)]")}
        >
            <div className="mb-4 max-w-2xl">
                <p className="text-[11px] font-bold tracking-[0.14em] text-[hsl(var(--brand-blue))]">{eyebrow}</p>
                <h2 id={headingId} className="mt-1 text-xl font-black tracking-tight text-foreground md:text-2xl">
                    {title}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                {courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                ))}
            </div>
        </section>
    );
}

export function CourseBoardSkeleton() {
    return (
        <div className="grid gap-3 pt-5 pb-5 md:grid-cols-2 md:gap-4 md:p-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <CompactCardSkeleton key={i} />
            ))}
        </div>
    );
}

export function CourseBoardError({
    message = "课程加载失败，请稍后重试。",
    retryHref,
}: {
    message?: string;
    retryHref: string;
}) {
    return (
        <div className="p-8 text-center text-muted-foreground">
            <p>{message}</p>
            <Button asChild variant="outline" className="mt-4">
                <Link href={retryHref}>重试</Link>
            </Button>
        </div>
    );
}

function CourseCard({ course }: { course: CourseListItem }) {
    const imageSrc = course.image_url || "/projects/tech_programming.webp";
    const progress = course.progress;
    const ProgressIcon =
        progress?.status === "completed"
            ? CheckCircle2
            : progress?.status === "in_progress"
                ? PlayCircle
                : Circle;

    return (
        <article className="group community-challenge-card md:grid-cols-[132px_minmax(0,1fr)]">
            <Link
                href={`/courses/${course.id}`}
                prefetch={false}
                className="absolute inset-0 z-10 rounded-sm"
                aria-label={`进入技能课程：${course.title}`}
            />
            <div className="relative aspect-square min-h-0 w-full self-start overflow-hidden rounded-xs nature-media-placeholder md:rounded-sm">
                <OptimizedImage
                    src={imageSrc}
                    alt={course.title}
                    fill
                    variant="thumbnail"
                    className="object-cover transition duration-500 group-hover:scale-105"
                />
            </div>
            <div className="pointer-events-none relative z-0 flex min-w-0 flex-col justify-center py-1 pr-1">
                <h3 className="line-clamp-2 text-[15px] font-black leading-[1.45] text-foreground min-[390px]:text-[16px] md:min-h-[48px] md:text-[17px] md:leading-6">
                    {course.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-[12px] leading-[1.55] text-muted-foreground min-[390px]:text-[13px] md:leading-5">
                    {course.description}
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {course.lesson_count} 课时
                    </span>
                    {course.tags?.slice(0, 2).map((tag) => (
                        <span
                            key={tag}
                            className={cn(
                                "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                                tag === "Scratch"
                                    ? "bg-[hsl(var(--tone-tech)/0.12)] text-[hsl(var(--tone-tech))]"
                                    : "bg-[hsl(var(--surface-muted))] text-muted-foreground",
                            )}
                        >
                            {tag}
                        </span>
                    )) ?? null}
                    {progress && progress.total_lesson_count > 0 ? (
                        <span className="hidden items-center gap-1 font-semibold text-foreground md:inline-flex">
                            <ProgressIcon
                                className={cn(
                                    "h-3.5 w-3.5",
                                    progress.status === "completed" && "text-[hsl(var(--status-success))]",
                                    progress.status === "in_progress" && "text-[hsl(var(--brand-blue))]",
                                )}
                                aria-hidden
                            />
                            {progress.completed_lesson_count}/{progress.total_lesson_count}
                        </span>
                    ) : null}
                </div>
                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 md:hidden">
                    {progress && progress.total_lesson_count > 0 ? (
                        <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-foreground">
                            <ProgressIcon
                                className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    progress.status === "completed" && "text-[hsl(var(--status-success))]",
                                    progress.status === "in_progress" && "text-[hsl(var(--brand-blue))]",
                                )}
                                aria-hidden
                            />
                            {progress.completed_lesson_count}/{progress.total_lesson_count}
                        </span>
                    ) : null}
                    <span className="ml-auto inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2.5 text-[12px] font-bold text-[hsl(var(--brand-blue))]">
                        {progress?.status === "completed"
                            ? "回顾课程"
                            : progress?.status === "in_progress"
                                ? "继续学习"
                                : "开始学习"}
                        <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                </div>
            </div>
            <span
                className={cn(
                    "pointer-events-none absolute bottom-3 right-3 z-0 hidden h-9 items-center gap-1 rounded-sm",
                    "bg-[hsl(var(--brand-blue))] px-4 text-[13px] font-bold text-[hsl(var(--brand-blue-foreground))]",
                    "md:inline-flex",
                )}
            >
                {progress?.status === "completed"
                    ? "回顾课程"
                    : progress?.status === "in_progress"
                        ? "继续学习"
                        : "开始学习"}
                <ChevronRight className="h-4 w-4" />
            </span>
        </article>
    );
}

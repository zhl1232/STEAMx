import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, PlayCircle } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { CompactCardSkeleton } from "@/components/ui/loading-skeleton";
import type { CourseListItem } from "@/lib/courses/types";
import { cn } from "@/lib/utils";
import { ContentClassification } from "@/components/ui/content-classification";

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
                    brickLayout
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
    brickLayout = false,
}: {
    eyebrow: string;
    title: string;
    description: string;
    courses: CourseListItem[];
    separated?: boolean;
    brickLayout?: boolean;
}) {
    const headingId = `course-section-${title}`;

    return (
        <section
            aria-labelledby={headingId}
            className={cn("py-2 md:py-4", separated && "mt-4 border-t border-[hsl(var(--surface-border)/0.6)] pt-6 md:mt-6")}
        >
            <div className="mb-3 px-1 md:mb-4">
                <p className="text-[11px] font-bold tracking-[0.14em] text-[hsl(var(--brand-blue))] uppercase">{eyebrow}</p>
                <h2 id={headingId} className="mt-0.5 text-lg font-black tracking-tight text-foreground md:mt-1 md:text-2xl">
                    {title}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground md:mt-1 md:text-sm md:leading-6">{description}</p>
            </div>
            <div className={cn("grid gap-3 md:gap-4 lg:grid-cols-2", brickLayout && "xl:grid-cols-3")}>
                {courses.map((course, index) => (
                    <CourseCard key={course.id} course={course} priority={index === 0 && !separated} />
                ))}
            </div>
        </section>
    );
}

export function CourseBoardSkeleton() {
    return (
        <div className="grid gap-3 pt-3 pb-5 md:grid-cols-2 md:gap-4 md:p-6">
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

function CourseCard({ course, priority = false }: { course: CourseListItem; priority?: boolean }) {
    const imageSrc = course.image_url || "/projects/tech_programming.webp";
    const progress = course.progress;
    const isBrick = isBrickCourse(course);
    const hasProgress = progress && progress.total_lesson_count > 0 && progress.status !== "not_started";
    const completed = hasProgress && progress.status === "completed";
    const actionLabel = completed ? "回顾课程" : hasProgress ? "继续学习" : "开始学习";
    const ProgressIcon = completed ? CheckCircle2 : PlayCircle;

    const progressPercent =
        progress && progress.total_lesson_count > 0
            ? Math.round((progress.completed_lesson_count / progress.total_lesson_count) * 100)
            : 0;

    return (
        <article className="group relative grid grid-cols-[88px_minmax(0,1fr)] content-start gap-x-3 overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-raised))] p-3 shadow-2xs transition-colors hover:border-[hsl(var(--brand-blue)/0.45)] min-[24rem]:grid-cols-[96px_minmax(0,1fr)] md:grid-cols-[120px_minmax(0,1fr)] md:gap-x-4 md:p-4 min-[90rem]:grid-cols-[144px_minmax(0,1fr)]">
            <Link
                href={`/courses/${course.id}`}
                prefetch={false}
                className="absolute inset-0 z-10 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue))] focus-visible:ring-offset-2"
                aria-label={`进入技能课程：${course.title}`}
            />

            {/* 左侧/顶部 3D 展台封面 */}
            <div
                className={cn(
                    "relative aspect-square w-full shrink-0 overflow-hidden rounded-sm",
                    isBrick
                        ? "bg-linear-to-br from-amber-500/10 via-orange-500/5 to-amber-500/5 dark:from-amber-400/12 dark:via-orange-400/8 dark:to-transparent"
                        : "bg-linear-to-br from-sky-500/10 via-blue-500/5 to-transparent dark:from-sky-400/12 dark:via-blue-400/8 dark:to-transparent",
                )}
            >
                <OptimizedImage
                    src={imageSrc}
                    alt={course.title}
                    fill
                    priority={priority}
                    variant="card"
                    className="object-contain p-2 transition-transform duration-500 group-hover:scale-108"
                    sizes="(min-width: 1440px) 144px, (min-width: 768px) 120px, (min-width: 384px) 96px, 88px"
                />
            </div>

            <div className="pointer-events-none min-w-0">
                <h3 className="line-clamp-2 text-base font-bold leading-5 text-foreground group-hover:text-[hsl(var(--brand-blue))] md:text-[17px] md:leading-6">
                    {course.title}
                </h3>
                <p className="mt-1 hidden text-[13px] leading-5 text-muted-foreground md:line-clamp-2">
                    {course.description}
                </p>
                <ContentClassification classification={course.classification} compact className="mt-2 [&>span]:text-[11px]" />
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="h-3 w-3" aria-hidden />
                    {course.lesson_count} 课时
                </div>
            </div>
            <div className="pointer-events-none col-span-2 mt-3 border-t border-[hsl(var(--surface-border)/0.5)] pt-2.5">
                <div className="flex items-center justify-between gap-2">
                    {hasProgress ? (
                        <span className="flex items-center gap-1 text-xs text-[hsl(var(--brand-blue))]">
                            <ProgressIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {completed ? "已完成" : `${progress.completed_lesson_count}/${progress.total_lesson_count}`}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{isBrick ? "3D 分步搭建" : "系统进阶学习"}</span>
                    )}
                    <span className="inline-flex min-h-7 shrink-0 items-center gap-0.5 rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2.5 text-xs font-bold text-[hsl(var(--brand-blue))]">
                        {actionLabel}<ChevronRight className="h-3 w-3" aria-hidden />
                    </span>
                </div>
                {hasProgress && !completed ? (
                    <div role="progressbar" aria-label="课程学习进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                        <div className="h-full rounded-full bg-[hsl(var(--brand-blue))]" style={{ width: `${progressPercent}%` }} />
                    </div>
                ) : null}
            </div>
        </article>
    );
}

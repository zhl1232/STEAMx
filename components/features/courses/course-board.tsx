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
            className={cn("py-2 md:py-4", separated && "mt-4 border-t border-[hsl(var(--surface-border)/0.6)] pt-6 md:mt-6")}
        >
            <div className="mb-3 px-1 md:mb-4">
                <p className="text-[11px] font-bold tracking-[0.14em] text-[hsl(var(--brand-blue))] uppercase">{eyebrow}</p>
                <h2 id={headingId} className="mt-0.5 text-lg font-black tracking-tight text-foreground md:mt-1 md:text-2xl">
                    {title}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground md:mt-1 md:text-sm md:leading-6">{description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
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
    const ProgressIcon =
        progress?.status === "completed"
            ? CheckCircle2
            : progress?.status === "in_progress"
                ? PlayCircle
                : Circle;

    const progressPercent =
        progress && progress.total_lesson_count > 0
            ? Math.round((progress.completed_lesson_count / progress.total_lesson_count) * 100)
            : 0;

    // 根据课程标题提取微年级标签
    const badgeText = course.title.includes("小班")
        ? "3+ 启蒙"
        : course.title.includes("中班")
            ? "4+ 进阶"
            : course.title.includes("大班")
                ? "5+ 创造"
                : null;

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-raised))] p-3 shadow-2xs transition-all duration-300 hover:border-[hsl(var(--brand-blue)/0.45)] hover:bg-[hsl(var(--surface-raised)/0.98)] hover:shadow-xs min-[390px]:p-3.5 sm:grid sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3.5 md:grid-cols-[132px_minmax(0,1fr)] md:p-4">
            <Link
                href={`/courses/${course.id}`}
                prefetch={false}
                className="absolute inset-0 z-10 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue))] focus-visible:ring-offset-2"
                aria-label={`进入技能课程：${course.title}`}
            />

            {/* 左侧/顶部 3D 展台封面 */}
            <div
                className={cn(
                    "relative aspect-4/3 w-full shrink-0 overflow-hidden rounded-sm sm:aspect-square sm:w-full",
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
                    sizes="(max-width: 640px) 100vw, 132px"
                />
                {badgeText ? (
                    <div className="absolute left-2 top-2 z-1">
                        <span className="inline-flex items-center rounded-xs bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/95 backdrop-blur-md">
                            {badgeText}
                        </span>
                    </div>
                ) : null}
            </div>

            {/* 右侧信息排版 */}
            <div className="pointer-events-none relative z-0 mt-3 flex min-w-0 flex-1 flex-col justify-between sm:mt-0">
                <div>
                    <h3 className="line-clamp-1 text-[15px] font-bold leading-tight text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))] min-[390px]:text-[16px] md:text-[17px]">
                        {course.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-muted-foreground min-[390px]:text-[13px]">
                        {course.description}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                            <BookOpen className="h-3 w-3 text-muted-foreground" />
                            {course.lesson_count} 课时
                        </span>
                        {course.tags?.slice(0, 2).map((tag) => (
                            <span
                                key={tag}
                                className="rounded bg-[hsl(var(--surface-muted))] px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* 进度条与行动胶囊 */}
                <div className="mt-3 border-t border-[hsl(var(--surface-border)/0.5)] pt-2.5">
                    {progress && progress.total_lesson_count > 0 ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="flex items-center gap-1 text-[hsl(var(--brand-blue))]">
                                    <ProgressIcon className="h-3.5 w-3.5 shrink-0" />
                                    {progress.completed_lesson_count}/{progress.total_lesson_count}
                                </span>
                                <span className="text-muted-foreground">{progressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                                <div
                                    className="h-full rounded-full bg-[hsl(var(--brand-blue))] transition-all duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground/80">
                                {isBrick ? "3D 分步搭建" : "系统进阶学习"}
                            </span>
                            <span className="inline-flex h-7 items-center gap-0.5 rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2.5 text-[11px] font-bold text-[hsl(var(--brand-blue))] transition-colors group-hover:bg-[hsl(var(--brand-blue))] group-hover:text-white">
                                开始学习
                                <ChevronRight className="h-3 w-3" />
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

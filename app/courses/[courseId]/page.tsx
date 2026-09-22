import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, CheckCircle2, ChevronRight, Clock } from "lucide-react";

import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { JsonLd } from "@/components/seo/json-ld";
import { CourseLessonCatalog } from "@/components/features/courses/course-lesson-catalog";
import { CourseShareButton } from "@/components/features/courses/course-share-button";
import { ContextualStoreProducts } from "@/components/store/contextual-store-products";
import { GomokuBoard } from "@/components/features/courses/gomoku-board";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { createClient } from "@/lib/supabase/server";
import { getCourseOverview } from "@/lib/api/courses";
import { listStoreProductsForContext } from "@/lib/store/service";
import { LESSON_CATALOG_MIN_SIZE } from "@/lib/courses/lesson-catalog";
import { buildLessonCatalogItems } from "@/lib/courses/lesson-catalog-builder";
import { buildBreadcrumbJsonLd, buildCourseJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { ContentClassification } from "@/components/ui/content-classification";

type PageProps = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: PageProps) {
    const { courseId } = await params;
    const supabase = await createClient();
    const course = await getCourseOverview(supabase, Number(courseId));
    if (!course) {
        return buildPageMetadata({
            title: "课程未找到",
            description: "技能课程",
            path: `/courses/${courseId}`,
            noIndex: true,
        });
    }
    return buildPageMetadata({
        title: course.title,
        description: (course.description ?? "按课表系统学习的 STEAM 技能课程").slice(0, 160),
        path: `/courses/${courseId}`,
        keywords: [course.title, "STEAM课程", "在线课程", ...(course.tags ?? [])],
        image: course.image_url ?? undefined,
    });
}

/**
 * 是否用棋盘装饰代替位图 Hero。
 * 五子棋课程（tags 含「五子棋」或所有课时都是 playground/gomoku）用纯 CSS/SVG 棋盘，
 * 其它课程仍走 course.image_url 位图，保持 Scratch/积木课的封面体系。
 */
function usesGomokuHero(course: Awaited<ReturnType<typeof getCourseOverview>>) {
    if (!course) return false;
    if (course.tags?.some((t) => t === "五子棋" || t === "gomoku")) return true;
    const playgroundLessons = course.lessons.filter((l) => l.lesson_type === "playground");
    if (playgroundLessons.length === 0) return false;
    return course.lessons.length === playgroundLessons.length;
}

export default async function CourseDetailPage({ params }: PageProps) {
    const { courseId: raw } = await params;
    const courseId = Number(raw);
    if (!Number.isFinite(courseId)) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const classificationSettings = await getContentClassificationSettings();
    const course = await getCourseOverview(supabase, courseId, {
        userId: user?.id ?? null,
        includeClassification: classificationSettings.publicV1Enabled,
    });
    if (!course) notFound();

    const contextualStoreProducts = await listStoreProductsForContext(supabase, `course:${course.id}`);

    const imageSrc = course.image_url || "/projects/tech_programming.webp";
    const isGomoku = usesGomokuHero(course);
    const allSameLessonType =
        course.lessons.length > 0 &&
        course.lessons.every((l) => l.lesson_type === course.lessons[0].lesson_type);
    // 大课的 sort_order 是拼音序，平铺一列找不到东西；小课的 sort_order 是真的教学顺序，保持原样
    const useCatalog = course.lessons.length >= LESSON_CATALOG_MIN_SIZE;
    const isBuildingCatalog = useCatalog && course.lessons.every((lesson) => lesson.lesson_type === "building_3d");
    const catalogLessons = useCatalog
        ? buildLessonCatalogItems(course.lessons, { showTypeLabel: !allSameLessonType })
        : [];
    const nextLessonId = course.progress?.next_lesson_id ?? course.lessons[0]?.id ?? null;
    const nextLessonIndex = course.lessons.findIndex((l) => l.id === nextLessonId);
    const nextLessonNumber = nextLessonIndex >= 0 ? nextLessonIndex + 1 : 1;
    const isNewBuildingLearner = isBuildingCatalog && (!course.progress || course.progress.status === "not_started");
    const primaryCta =
        course.progress?.status === "completed"
            ? "回顾课程"
            : course.progress?.status === "in_progress"
                ? `继续 第 ${nextLessonNumber} 课`
                : `开始 第 1 课`;
    const catalogAnchor = `#course-lessons-heading`;
    return (
        <>
            <JsonLd
                data={buildCourseJsonLd({
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    image: course.image_url,
                    classification: course.classification,
                    lessons: course.lessons.map((lesson) => ({
                        id: lesson.id,
                        title: lesson.title,
                        summary: lesson.summary,
                        durationMinutes: lesson.duration_minutes,
                    })),
                })}
            />
            <JsonLd
                data={buildBreadcrumbJsonLd([
                    { name: "首页", url: "/" },
                    { name: "技能课程", url: "/courses" },
                    { name: course.title, url: `/courses/${course.id}` },
                ])}
            />
            <div className="min-h-screen app-canvas-community">
                <MobileGlobalHeader variant="title" title={course.title} />
                <main className="app-shell-wide pb-28 pt-4 md:py-6">
                {/* 返回链接 */}
                <Link
                    href="/courses"
                    className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground md:mb-4 md:text-sm"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回全部课程
                </Link>

                {/* Hero 卡：左文右图，五子棋课用棋盘 SVG，其它课用位图 */}
                <section className="surface-card overflow-hidden rounded-xl">
                    <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        {/* 移动端：棋盘在上、文字在下；桌面端：文字在左、棋盘在右 */}
                        <div className="relative order-first min-h-[200px] border-border md:order-2 md:min-h-[260px] md:border-l lg:min-h-[320px]">
                            {isGomoku ? (
                                <GomokuHeroVisual />
                            ) : (
                                <OptimizedImage
                                    src={imageSrc}
                                    alt={course.title}
                                    fill
                                    variant="cover"
                                    className="object-cover"
                                />
                            )}
                        </div>

                        <div className="order-2 flex flex-col justify-center p-5 md:order-1 md:p-8 lg:p-10">
                            {course.classification || isGomoku ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <ContentClassification classification={course.classification} compact />
                                    {isGomoku ? (
                                        <span className="inline-flex items-center rounded-lg bg-[hsl(var(--tone-math)/0.12)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--tone-math))]">
                                            博弈论 · 算法
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}

                            <h1 className="mt-3 font-sans text-2xl font-black leading-tight tracking-tight text-foreground md:mt-4 md:text-[2.15rem] md:leading-[1.18]">
                                {course.title}
                            </h1>

                            {course.description ? (
                                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground md:mt-3.5 md:text-[15px] md:leading-7">
                                    {course.description}
                                </p>
                            ) : null}

                            {course.tags?.length ? (
                                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    {course.tags
                                        .filter((tag) => tag !== "3+" && !/^\d+\+?$/.test(tag) && !tag.endsWith("岁"))
                                        .slice(0, 5)
                                        .map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-md border border-border/40 bg-secondary/60 px-2 py-0.5 font-medium transition-colors hover:bg-secondary"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                </div>
                            ) : null}

                            {course.progress && course.progress.completed_lesson_count > 0 ? (
                                <div className="mt-4.5 rounded-xl border border-border/60 bg-secondary/40 p-3.5 backdrop-blur-xs md:mt-5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 font-bold text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--brand-blue))]" aria-hidden />
                                            已完成 {course.progress.completed_lesson_count} / {course.progress.total_lesson_count || course.lessons.length} 课时
                                        </span>
                                        <span className="font-black tabular-nums text-[hsl(var(--brand-blue))]">
                                            {Math.min(
                                                100,
                                                Math.round(
                                                    (course.progress.completed_lesson_count /
                                                        (course.progress.total_lesson_count || course.lessons.length)) *
                                                        100,
                                                ),
                                            )}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={Math.min(
                                            100,
                                            Math.round(
                                                (course.progress.completed_lesson_count /
                                                    (course.progress.total_lesson_count || course.lessons.length)) *
                                                    100,
                                            ),
                                        )}
                                        className="mt-2.5 h-2 bg-secondary"
                                    />
                                </div>
                            ) : null}

                            <div className="mt-6 flex flex-wrap items-center gap-2.5 md:mt-7">
                                {nextLessonId && !isNewBuildingLearner ? (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="group min-w-0 flex-1 gap-2 rounded-xl bg-[hsl(var(--brand-blue))] px-4 font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_4px_16px_-4px_hsl(var(--brand-blue)/0.4)] transition-all hover:bg-[hsl(var(--brand-blue)/0.9)] hover:shadow-[0_6px_20px_-4px_hsl(var(--brand-blue)/0.5)] active:scale-[0.98] sm:flex-initial sm:px-6"
                                    >
                                        <Link
                                            href={`/courses/${course.id}/lessons/${nextLessonId}`}
                                            prefetch={false}
                                        >
                                            {primaryCta}
                                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </Button>
                                ) : null}

                                {isBuildingCatalog ? (
                                    <Button
                                        asChild
                                        variant={isNewBuildingLearner ? "default" : "secondary"}
                                        size="lg"
                                        className="min-w-0 flex-1 gap-2 rounded-xl border border-border/70 px-4 font-bold transition-all hover:bg-secondary hover:text-foreground active:scale-[0.98] sm:flex-initial"
                                    >
                                        <a href={catalogAnchor}>
                                            {isNewBuildingLearner ? "挑一个作品开始" : "挑选作品"}
                                            <ChevronRight className="h-4 w-4" />
                                        </a>
                                    </Button>
                                ) : null}

                                {course.progress?.milestone_completed_at ? (
                                    <Button
                                        asChild
                                        variant="secondary"
                                        size="lg"
                                        className="gap-2 rounded-xl border border-border/70 bg-secondary/80 font-bold text-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-[0.98]"
                                    >
                                        <Link href={`/courses/${course.id}/certificate`} prefetch={false}>
                                            <Award className="h-4 w-4 text-amber-500" aria-hidden />
                                            结课凭证
                                        </Link>
                                    </Button>
                                ) : null}

                                <CourseShareButton
                                    course={{
                                        id: course.id,
                                        title: course.title,
                                        description: course.description,
                                        image: course.image_url,
                                        lessonCount: course.lessons.length,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {contextualStoreProducts.length > 0 ? (
                    <div className="mt-6 md:mt-8">
                        <ContextualStoreProducts products={contextualStoreProducts} contextLabel="这门课程的" />
                    </div>
                ) : null}

                {/* 课时列表 */}
                <section id="course-lessons-heading" className="mt-6 scroll-mt-24 md:mt-8" aria-labelledby="course-lessons-heading-label">
                    <div className="mb-3 flex items-baseline justify-between md:mb-4">
                        <h2
                            id="course-lessons-heading-label"
                            className="text-base font-black tracking-tight text-foreground md:text-lg"
                        >
                            课时列表
                        </h2>
                        {!useCatalog ? (
                            <span className="text-xs font-semibold text-muted-foreground">
                                {course.lessons.length} 节
                            </span>
                        ) : null}
                    </div>

                    {useCatalog ? (
                        <CourseLessonCatalog
                            courseId={course.id}
                            lessons={catalogLessons}
                            showProgressFilters={Boolean(user)}
                            desktopCards={isBuildingCatalog}
                        />
                    ) : (
                    <ol className="space-y-2 md:space-y-2.5">
                        {course.lessons.map((lesson, index) => {
                            return (
                                <li key={lesson.id}>
                                    <Link
                                        href={`/courses/${course.id}/lessons/${lesson.id}`}
                                        prefetch={false}
                                        className="surface-card surface-card-interactive group flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 transition-all hover:border-[hsl(var(--brand-blue)/0.4)] md:px-4 md:py-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <LessonIndexBadge
                                                index={index}
                                                isPlayground={lesson.lesson_type === "playground"}
                                            />
                                            <span className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))] md:text-[15px]">
                                                {lesson.title}
                                            </span>
                                            {lesson.is_completed ? (
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[hsl(var(--status-success)/0.1)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--status-success))]">
                                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                                    已完成
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                            {lesson.duration_minutes ? (
                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                    <Clock className="h-3 w-3" aria-hidden />
                                                    约 {lesson.duration_minutes} 分钟
                                                </span>
                                            ) : null}
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--brand-blue))]" />
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                    )}
                </section>
                </main>
            </div>
        </>
    );
}

/** 课时序号徽章：playground 课时用「棋子」造型，其它课用品牌蓝圆。 */
function LessonIndexBadge({
    index,
    isPlayground,
}: {
    index: number;
    isPlayground: boolean;
}) {
    if (isPlayground) {
        // 黑白棋子造型：奇数黑子、偶数白子，呼应五子棋主题
        const isBlack = index % 2 === 0;
        return (
            <span
                aria-hidden
                className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black shadow-xs md:h-12 md:w-12",
                    isBlack
                        ? "bg-linear-to-br from-slate-800 to-slate-950 text-white ring-1 ring-slate-900/20 dark:from-slate-100 dark:to-white dark:text-slate-900 dark:ring-slate-100/30"
                        : "bg-linear-to-br from-white to-slate-100 text-slate-900 ring-1 ring-slate-300 dark:from-slate-700 dark:to-slate-800 dark:text-slate-100 dark:ring-slate-600",
                )}
            >
                {index + 1}
            </span>
        );
    }

    return (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.12)] text-sm font-black text-[hsl(var(--brand-blue))] ring-1 ring-inset ring-[hsl(var(--brand-blue)/0.2)] md:h-12 md:w-12">
            {index + 1}
        </span>
    );
}

/**
 * 五子棋课程 Hero 视觉：复用 GomokuBoard 组件，呈现黑方五连获胜的局面。
 */
function GomokuHeroVisual() {
    const blackStones = [
        { r: 6, c: 6 },
        { r: 7, c: 7 },
        { r: 8, c: 8 },
        { r: 9, c: 9 },
        { r: 10, c: 10 },
    ];
    const whiteStones = [
        { r: 6, c: 7 },
        { r: 7, c: 8 },
        { r: 8, c: 9 },
        { r: 9, c: 10 },
    ];

    return (
        <div className="relative h-full w-full bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.1)_0%,hsl(var(--surface-muted))_60%)] dark:bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.12)_0%,hsl(var(--surface-muted)/0.6)_60%)]">
            <div className="absolute inset-0 grid place-items-center p-4 md:p-6">
                <GomokuBoard
                    blackStones={blackStones}
                    whiteStones={whiteStones}
                    winLine={{ from: blackStones[0], to: blackStones[4] }}
                    ariaLabel="五子棋棋盘示意，黑方连成五子获胜"
                    className="max-w-[280px] drop-shadow-[0_18px_30px_hsl(var(--surface-shadow)/0.25)] md:max-w-[360px]"
                />
            </div>
        </div>
    );
}

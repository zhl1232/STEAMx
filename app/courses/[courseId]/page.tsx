import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock } from "lucide-react";

import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetail } from "@/lib/api/courses";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: PageProps) {
    const { courseId } = await params;
    const supabase = await createClient();
    const course = await getCourseDetail(supabase, Number(courseId));
    if (!course) {
        return buildPageMetadata({
            title: "课程未找到",
            description: "训练营课程",
            path: `/courses/${courseId}`,
        });
    }
    return buildPageMetadata({
        title: course.title,
        description: course.description ?? "Scratch 少儿编程训练营",
        path: `/courses/${courseId}`,
    });
}

export default async function CourseDetailPage({ params }: PageProps) {
    const { courseId: raw } = await params;
    const courseId = Number(raw);
    if (!Number.isFinite(courseId)) notFound();

    const supabase = await createClient();
    const course = await getCourseDetail(supabase, courseId);
    if (!course) notFound();

    const imageSrc = course.image_url || "/projects/tech_programming.webp";

    return (
        <div className="min-h-screen app-canvas-community">
            <MobileGlobalHeader variant="title" title={course.title} />
            <main className="app-shell-wide pb-28 pt-4 md:py-6">
                <div className="surface-card overflow-hidden rounded-[var(--radius-xl)]">
                    <div className="relative h-40 md:h-48">
                        <OptimizedImage
                            src={imageSrc}
                            alt={course.title}
                            fill
                            variant="cover"
                            className="object-cover"
                        />
                    </div>
                    <div className="p-5 md:p-8">
                        <h1 className="text-2xl font-black">{course.title}</h1>
                        <p className="mt-3 text-muted-foreground leading-relaxed">
                            {course.description}
                        </p>
                        <p className="mt-4 text-sm text-muted-foreground">
                            共 {course.lessons.length} 课时 · 难度 {course.difficulty_stars} 星
                        </p>
                    </div>
                </div>

                <section className="mt-6">
                    <h2 className="mb-3 text-lg font-bold">课时列表</h2>
                    <ol className="space-y-2">
                        {course.lessons.map((lesson, index) => (
                            <li key={lesson.id}>
                                <Link
                                    href={`/courses/${course.id}/lessons/${lesson.id}`}
                                    className="surface-panel flex items-center gap-4 rounded-[var(--radius-md)] px-4 py-4 transition hover:bg-muted/40"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-blue)/0.15)] text-sm font-black text-[hsl(var(--brand-blue))]">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-foreground">{lesson.title}</div>
                                        {lesson.duration_minutes ? (
                                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                约 {lesson.duration_minutes} 分钟
                                            </span>
                                        ) : null}
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            </main>
        </div>
    );
}

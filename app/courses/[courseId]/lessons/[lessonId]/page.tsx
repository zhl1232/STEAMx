import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { LessonPageClient } from "./lesson-page-client";
import { createClient } from "@/lib/supabase/server";
import { getLessonInCourse, getUserLessonProgress } from "@/lib/api/courses";
import { buildBreadcrumbJsonLd, buildLessonJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = {
    params: Promise<{ courseId: string; lessonId: string }>;
    searchParams: Promise<{ step?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
    const { courseId, lessonId } = await params;
    const supabase = await createClient();
    const context = await getLessonInCourse(supabase, Number(courseId), Number(lessonId));
    if (!context) {
        return buildPageMetadata({
            title: "课时",
            description: "技能课程",
            path: `/courses/${courseId}/lessons/${lessonId}`,
            noIndex: true,
        });
    }
    const content = context.lesson.content as { summary?: unknown; building3d?: { finishedImageUrl?: unknown } } | null;
    const summary = typeof content?.summary === "string" ? content.summary : null;
    const finishedImage =
        typeof content?.building3d?.finishedImageUrl === "string" ? content.building3d.finishedImageUrl : undefined;
    return buildPageMetadata({
        title: `${context.lesson.title} · ${context.course.title}`,
        description: (summary ?? context.course.description ?? "技能课程课时学习").slice(0, 160),
        path: `/courses/${courseId}/lessons/${lessonId}`,
        keywords: [context.lesson.title, context.course.title, "STEAM课时", "在线学习"],
        image: finishedImage ?? context.course.image_url ?? undefined,
    });
}

export default async function LessonPage({ params, searchParams }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const { step: rawStep } = await searchParams;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
    const parsedStep = Number(Array.isArray(rawStep) ? rawStep[0] : rawStep);
    const initialStepIndex = Number.isSafeInteger(parsedStep) && parsedStep > 0
        ? parsedStep - 1
        : 0;
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

    const supabase = await createClient();
    const context = await getLessonInCourse(supabase, courseId, lessonId);
    if (!context) notFound();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const progress = user
        ? await getUserLessonProgress(supabase, user.id, lessonId)
        : null;

    const content = context.lesson.content as { summary?: unknown; building3d?: { finishedImageUrl?: unknown } } | null;
    const summary = typeof content?.summary === "string" ? content.summary : context.course.description;
    const finishedImage =
        typeof content?.building3d?.finishedImageUrl === "string" ? content.building3d.finishedImageUrl : context.course.image_url;

    return (
        <>
            <JsonLd
                data={buildLessonJsonLd({
                    id: context.lesson.id,
                    courseId: context.course.id,
                    courseTitle: context.course.title,
                    title: context.lesson.title,
                    description: summary,
                    image: finishedImage,
                    durationMinutes: context.lesson.duration_minutes,
                    steps: context.lesson.steps,
                })}
            />
            <JsonLd
                data={buildBreadcrumbJsonLd([
                    { name: "首页", url: "/" },
                    { name: "技能课程", url: "/courses" },
                    { name: context.course.title, url: `/courses/${context.course.id}` },
                    {
                        name: context.lesson.title,
                        url: `/courses/${context.course.id}/lessons/${context.lesson.id}`,
                    },
                ])}
            />
            <LessonPageClient
                courseId={courseId}
                courseTitle={context.course.title}
                lesson={context.lesson}
                previewHref={`/courses/${courseId}/lessons/${lessonId}/preview`}
                initialCompleted={Boolean(progress?.completed_at)}
                initialStepIndex={initialStepIndex}
                shouldRecordStart={Boolean(user) && !progress}
            />
        </>
    );
}

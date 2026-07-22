import { notFound } from "next/navigation";

import { LessonPageClient } from "./lesson-page-client";
import { createClient } from "@/lib/supabase/server";
import { getLessonInCourse, getUserLessonProgress } from "@/lib/api/courses";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = {
    params: Promise<{ courseId: string; lessonId: string }>;
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
        });
    }
    return buildPageMetadata({
        title: `${context.lesson.title} · ${context.course.title}`,
        description: context.course.description ?? "技能课程课时学习",
        path: `/courses/${courseId}/lessons/${lessonId}`,
    });
}

export default async function LessonPage({ params }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
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

    return (
        <LessonPageClient
            courseId={courseId}
            courseTitle={context.course.title}
            lesson={context.lesson}
            previewHref={`/courses/${courseId}/lessons/${lessonId}/preview`}
            initialCompleted={Boolean(progress?.completed_at)}
        />
    );
}

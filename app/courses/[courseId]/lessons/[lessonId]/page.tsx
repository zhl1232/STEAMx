import { notFound } from "next/navigation";

import { LessonPageClient } from "./lesson-page-client";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetail } from "@/lib/api/courses";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = {
    params: Promise<{ courseId: string; lessonId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
    const { courseId, lessonId } = await params;
    const supabase = await createClient();
    const course = await getCourseDetail(supabase, Number(courseId));
    const lesson = course?.lessons.find((l) => l.id === Number(lessonId));
    if (!lesson) {
        return buildPageMetadata({
            title: "课时",
            description: "Scratch 训练营",
            path: `/courses/${courseId}/lessons/${lessonId}`,
        });
    }
    return buildPageMetadata({
        title: `${lesson.title} · ${course?.title ?? "训练营"}`,
        description: course?.description ?? "Scratch 课时学习",
        path: `/courses/${courseId}/lessons/${lessonId}`,
    });
}

export default async function LessonPage({ params }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

    const supabase = await createClient();
    const course = await getCourseDetail(supabase, courseId);
    if (!course) notFound();

    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) notFound();

    return (
        <LessonPageClient
            courseId={courseId}
            courseTitle={course.title}
            lesson={lesson}
            previewHref={`/courses/${courseId}/lessons/${lessonId}/preview`}
        />
    );
}

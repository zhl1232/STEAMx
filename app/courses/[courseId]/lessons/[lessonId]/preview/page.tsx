import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ScratchWorkspace } from "@/components/features/courses/scratch-workspace";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { createClient } from "@/lib/supabase/server";
import { getLessonInCourse } from "@/lib/api/courses";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";

type PageProps = {
    params: Promise<{ courseId: string; lessonId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { courseId, lessonId } = await params;

    return buildPageMetadata({
        title: "作品预览",
        description: "Scratch 作品预览模式",
        path: `/courses/${courseId}/lessons/${lessonId}`,
        noIndex: true,
    });
}

const PREVIEW_HEIGHT = "max-md:h-full md:min-h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

export default async function LessonPreviewPage({ params }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

    const supabase = await createClient();
    const context = await getLessonInCourse(supabase, courseId, lessonId);
    if (!context) notFound();

    return (
        <div className={cn("flex flex-col overflow-hidden", PREVIEW_HEIGHT)}>
            <MobileGlobalHeader variant="title" title={`预览 · ${context.lesson.title}`} />
            <ScratchWorkspace courseId={courseId} lessonId={lessonId} playerOnly />
        </div>
    );
}

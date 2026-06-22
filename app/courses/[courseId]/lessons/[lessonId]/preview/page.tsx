import { notFound } from "next/navigation";

import { ScratchWorkspace } from "@/components/features/courses/scratch-workspace";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetail } from "@/lib/api/courses";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";

type PageProps = {
    params: Promise<{ courseId: string; lessonId: string }>;
};

export const metadata = buildPageMetadata({
    title: "作品预览",
    description: "Scratch 作品预览模式",
    path: "/courses",
});

const PREVIEW_HEIGHT = "max-md:h-full md:min-h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

export default async function LessonPreviewPage({ params }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

    const supabase = await createClient();
    const course = await getCourseDetail(supabase, courseId);
    const lesson = course?.lessons.find((l) => l.id === lessonId);
    if (!course || !lesson) notFound();

    return (
        <div className={cn("flex flex-col overflow-hidden", PREVIEW_HEIGHT)}>
            <MobileGlobalHeader variant="title" title={`预览 · ${lesson.title}`} />
            <ScratchWorkspace courseId={courseId} lessonId={lessonId} playerOnly />
        </div>
    );
}

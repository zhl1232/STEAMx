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
    searchParams?: Promise<{ source?: string | string[] }>;
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

export default async function LessonPreviewPage({ params, searchParams }: PageProps) {
    const { courseId: cRaw, lessonId: lRaw } = await params;
    const courseId = Number(cRaw);
    const lessonId = Number(lRaw);
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();
    const { source: rawSource } = await (searchParams ?? Promise.resolve({ source: undefined }));
    const source = (Array.isArray(rawSource) ? rawSource[0] : rawSource) === "reference"
        ? "reference"
        : "own";

    const supabase = await createClient();
    const context = await getLessonInCourse(supabase, courseId, lessonId);
    if (!context) notFound();
    const scratch = (context.lesson.content as { scratch?: { starterProjectUrl?: unknown; referenceProjectUrl?: unknown } } | null)?.scratch;
    const starterProjectUrl = typeof scratch?.starterProjectUrl === "string" && scratch.starterProjectUrl.startsWith("/api/assets/")
        ? scratch.starterProjectUrl
        : null;
    const referenceProjectUrl = typeof scratch?.referenceProjectUrl === "string" && scratch.referenceProjectUrl.startsWith("/api/assets/")
        ? scratch.referenceProjectUrl
        : null;

    return (
        <div className={cn("flex flex-col overflow-hidden", PREVIEW_HEIGHT)}>
            <MobileGlobalHeader variant="title" title={`预览 · ${context.lesson.title}`} />
            <ScratchWorkspace
                courseId={courseId}
                lessonId={lessonId}
                playerOnly
                projectSource={source}
                starterProjectUrl={starterProjectUrl}
                referenceProjectUrl={referenceProjectUrl}
            />
        </div>
    );
}

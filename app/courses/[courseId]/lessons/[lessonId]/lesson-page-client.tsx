"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Smartphone } from "lucide-react";

import { LessonSidebar } from "@/components/features/courses/lesson-sidebar";
import { ScratchWorkspace } from "@/components/features/courses/scratch-workspace";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { Button } from "@/components/ui/button";
import { canUseScratchEditor } from "@/lib/courses/device";
import type { CourseLessonRow } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/** 课时页可用高度：桌面顶栏 4rem；移动顶栏用 shell 的 CSS 变量 */
const LESSON_PAGE_HEIGHT =
    "max-md:min-h-[calc(100dvh-var(--mobile-global-header-height,3rem)-env(safe-area-inset-top))] md:min-h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

export function LessonPageClient({
    courseId,
    courseTitle,
    lesson,
    previewHref,
}: {
    courseId: number;
    courseTitle: string;
    lesson: CourseLessonRow;
    previewHref: string;
}) {
    const [activeStep, setActiveStep] = useState(0);
    const [completed, setCompleted] = useState(false);
    const showEditor = canUseScratchEditor();

    return (
        <div
            className={cn(
                "flex flex-col overflow-hidden bg-background",
                LESSON_PAGE_HEIGHT,
            )}
        >
            <MobileGlobalHeader variant="title" title={lesson.title} />
            <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
                <Link
                    href={`/courses/${courseId}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground"
                >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    {courseTitle}
                </Link>
            </div>
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <div
                    className={cn(
                        "flex shrink-0 flex-col border-border lg:w-[min(100%,300px)] lg:border-r xl:w-[320px]",
                        "max-lg:max-h-[38vh] max-lg:border-b",
                        "lg:min-h-0 lg:max-h-none",
                    )}
                >
                    <LessonSidebar
                        courseId={courseId}
                        courseTitle={courseTitle}
                        lesson={lesson}
                        activeStepIndex={activeStep}
                        onStepClick={setActiveStep}
                        completed={completed}
                    />
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    {!showEditor ? (
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                建议在平板或电脑上使用完整编辑器
                            </p>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={previewHref}>
                                    <Smartphone className="mr-1 h-4 w-4" />
                                    预览
                                </Link>
                            </Button>
                        </div>
                    ) : null}
                    <ScratchWorkspace
                        courseId={courseId}
                        lessonId={lesson.id}
                        onCompleted={() => setCompleted(true)}
                    />
                </div>
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Smartphone } from "lucide-react";

import { LessonSidebar } from "@/components/features/courses/lesson-sidebar";
import { ScratchWorkspace } from "@/components/features/courses/scratch-workspace";
import { useTutorContext } from "@/components/features/tutor/tutor-context";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { Button } from "@/components/ui/button";
import type { TutorToolCall } from "@/lib/ai/tutor/tool-calls";
import { canUseScratchEditor } from "@/lib/courses/device";
import type { CourseLessonRow } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/** 课时页可用高度：桌面顶栏 4rem；移动顶栏用 shell 的 CSS 变量 */
const LESSON_PAGE_HEIGHT =
    "max-md:h-[calc(100dvh-var(--mobile-global-header-height,3rem)-env(safe-area-inset-top))] md:h-[calc(100dvh-4rem)]";

export function LessonPageClient({
    courseId,
    courseTitle,
    lesson,
    previewHref,
    initialCompleted = false,
}: {
    courseId: number;
    courseTitle: string;
    lesson: CourseLessonRow;
    previewHref: string;
    initialCompleted?: boolean;
}) {
    const [activeStep, setActiveStep] = useState(0);
    const [completed, setCompleted] = useState(initialCompleted);
    const [focusedStep, setFocusedStep] = useState<number | null>(null);
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { registerToolHandler, setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext();
    const showEditor = canUseScratchEditor();
    const steps = lesson.steps;
    const clampedActiveStep = steps.length > 0 ? Math.min(activeStep, steps.length - 1) : 0;
    const activeStepTitle = steps[clampedActiveStep]?.title;

    const focusLessonStepFromTutorTool = useCallback((toolCall: TutorToolCall) => {
        if (toolCall.name !== "course.focus_lesson_step") return;
        if (toolCall.payload.lessonId !== lesson.id) return;

        const maxStepIndex = Math.max(steps.length - 1, 0);
        const targetIndex = Math.min(Math.max(toolCall.payload.stepIndex, 0), maxStepIndex);
        setActiveStep(targetIndex);
        setFocusedStep(targetIndex);

        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => {
            setFocusedStep(null);
            focusTimerRef.current = null;
        }, 3600);
    }, [lesson.id, steps.length]);

    useEffect(() => {
        return registerToolHandler("course.focus_lesson_step", focusLessonStepFromTutorTool);
    }, [focusLessonStepFromTutorTool, registerToolHandler]);

    useEffect(() => {
        setTutorOverride({
            lessonStepIndex: steps.length > 0 ? clampedActiveStep : undefined,
            subtitle: activeStepTitle
                ? `正在做「${activeStepTitle}」`
                : lesson.title,
            quickPrompts: ["这一步怎么做？", "我卡住了", "下一步该做什么？"],
        });

        return () => {
            clearTutorOverride();
        };
    }, [activeStepTitle, clearTutorOverride, clampedActiveStep, lesson.title, setTutorOverride, steps.length]);

    useEffect(() => {
        return () => {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        };
    }, []);

    return (
        <div
            className={cn(
                "mx-auto flex w-full flex-col overflow-hidden app-canvas",
                LESSON_PAGE_HEIGHT,
            )}
            style={{ maxWidth: "var(--shell-wide)" }}
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
                        activeStepIndex={clampedActiveStep}
                        focusedStepIndex={focusedStep}
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
                        tutorialDeckId={
                            typeof lesson.content?.tutorialDeckId === "string"
                                ? lesson.content.tutorialDeckId
                                : undefined
                        }
                        initialCompleted={initialCompleted}
                        onCompleted={() => setCompleted(true)}
                    />
                </div>
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { LessonSidebar } from "@/components/features/courses/lesson-sidebar";
import { LessonWorkspaceRenderer } from "@/components/features/courses/lesson-workspace-renderer";
import type { ScratchWorkspaceBlockHint } from "@/components/features/courses/scratch-workspace";
import { useTutorContext } from "@/components/features/tutor/tutor-context";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import type { TutorToolCall } from "@/lib/ai/tutor/tool-calls";
import { getLessonTypeDefinition } from "@/lib/courses/lesson-types";
import type { ScratchEditorContext } from "@/lib/courses/scratch-messages";
import type { CourseLessonRow } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/** 课时页可用高度：移动端填满 shell main；桌面减去顶栏 */
const LESSON_PAGE_HEIGHT = "max-md:h-full md:h-[calc(100dvh-4rem)]";

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
    const [scratchBlockHint, setScratchBlockHint] = useState<ScratchWorkspaceBlockHint | null>(null);
    const [scratchEditorContext, setScratchEditorContext] = useState<ScratchEditorContext | null>(null);
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { registerToolHandler, setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext();
    const steps = lesson.steps ?? [];
    const clampedActiveStep = steps.length > 0 ? Math.min(activeStep, steps.length - 1) : 0;
    const activeStepTitle = steps[clampedActiveStep]?.title;
    const lessonWorkspace = getLessonTypeDefinition(lesson.lesson_type).workspace;
    const isBuildingLesson = lessonWorkspace === "building_3d";

    const focusLessonStepFromTutorTool = useCallback((toolCall: TutorToolCall) => {
        if (toolCall.name !== "course.focus_lesson_step" && toolCall.name !== "course.highlight_scratch_blocks") return;
        if (toolCall.payload.lessonId !== lesson.id) return;

        const maxStepIndex = Math.max(steps.length - 1, 0);
        const targetIndex = Math.min(Math.max(toolCall.payload.stepIndex, 0), maxStepIndex);
        setActiveStep(targetIndex);
        setFocusedStep(targetIndex);
        if (toolCall.name === "course.highlight_scratch_blocks") {
            setScratchBlockHint({
                stepIndex: targetIndex,
                keywords: toolCall.payload.keywords.slice(0, 4),
                items: toolCall.payload.items?.slice(0, 4),
                category: toolCall.payload.category,
                reason: toolCall.payload.reason,
            });
        }

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
        return registerToolHandler("course.highlight_scratch_blocks", focusLessonStepFromTutorTool);
    }, [focusLessonStepFromTutorTool, registerToolHandler]);

    useEffect(() => {
        setTutorOverride({
            subtitle: activeStepTitle ? `正在做「${activeStepTitle}」` : lesson.title,
            lessonStepIndex: clampedActiveStep,
            scratchEditorContext,
            quickPrompts: ["这一步怎么做？", "我卡住了", "下一步该做什么？"],
        });

        return () => {
            clearTutorOverride();
        };
    }, [activeStepTitle, clampedActiveStep, clearTutorOverride, lesson.title, scratchEditorContext, setTutorOverride]);

    useEffect(() => {
        return () => {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        };
    }, []);

    useEffect(() => {
        setScratchBlockHint((current) => {
            if (!current || current.stepIndex === clampedActiveStep) return current;
            return null;
        });
    }, [clampedActiveStep]);

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
                        "flex flex-col border-border lg:w-[min(100%,300px)] lg:border-r xl:w-[320px]",
                        "max-lg:max-h-[min(48vh,28rem)] max-lg:min-h-0 max-lg:shrink-0 max-lg:overflow-hidden max-lg:border-b",
                        isBuildingLesson && "max-lg:max-h-[min(58vh,32rem)]",
                        "lg:min-h-0 lg:max-h-none lg:shrink-0",
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
                    <LessonWorkspaceRenderer
                        courseId={courseId}
                        lesson={lesson}
                        previewHref={previewHref}
                        activeStepIndex={clampedActiveStep}
                        scratchBlockHint={scratchBlockHint}
                        onDismissScratchBlockHint={() => setScratchBlockHint(null)}
                        onScratchEditorContextChange={setScratchEditorContext}
                        onStepChange={setActiveStep}
                        initialCompleted={initialCompleted}
                        onCompleted={() => setCompleted(true)}
                    />
                </div>
            </div>
        </div>
    );
}

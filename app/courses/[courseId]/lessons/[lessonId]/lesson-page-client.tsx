"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { LessonSidebar } from "@/components/features/courses/lesson-sidebar";
import { LessonWorkspaceRenderer } from "@/components/features/courses/lesson-workspace-renderer";
import { getTutorSceneCapabilities } from "@/components/features/tutor/tool-handler-registry";
import type { ScratchWorkspaceBlockHint } from "@/components/features/courses/scratch-workspace";
import { useTutorContext } from "@/components/features/tutor/tutor-context";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import type { TutorToolCall } from "@/lib/ai/tutor/tool-calls";
import { getLessonTypeDefinition } from "@/lib/courses/lesson-types";
import type { ScratchBlockHintItem } from "@/lib/courses/scratch-hints";
import type { ScratchEditorContext } from "@/lib/courses/scratch-messages";
import type { CourseLessonRow } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/** 交互式编辑/搭建课需要固定工作区；阅读型 playground 课在移动端应交给页面自然滚动。 */
const FIXED_LESSON_PAGE_HEIGHT = "max-md:h-[100dvh] md:h-[calc(100dvh-4rem)]";
const SCROLL_LESSON_PAGE_HEIGHT = "max-md:min-h-screen md:h-[calc(100dvh-4rem)]";

function getHintTargetCount(payload: {
    keywords: string[];
    items?: ScratchBlockHintItem[];
}) {
    return Math.max(payload.items?.length ?? 0, payload.keywords.length);
}

function clampHintTargetIndex(index: number | undefined, count: number) {
    if (count <= 0) return undefined;
    if (typeof index !== "number" || !Number.isFinite(index)) return 0;
    return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

function shouldReuseScratchHintTarget(
    current: ScratchWorkspaceBlockHint | null,
    payload: Extract<TutorToolCall, { name: "course.highlight_scratch_blocks" }>["payload"],
    targetIndex: number | undefined,
) {
    if (!current) return false;
    if (current.stepIndex !== payload.stepIndex) return false;
    if (payload.reason !== "next_step") return false;
    if (typeof targetIndex === "number") return false;
    return getHintTargetCount(payload) > 1;
}

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
    const { registerToolHandlers, setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext();
    const steps = lesson.steps ?? [];
    const clampedActiveStep = steps.length > 0 ? Math.min(activeStep, steps.length - 1) : 0;
    const activeStepTitle = steps[clampedActiveStep]?.title;
    const lessonWorkspace = getLessonTypeDefinition(lesson.lesson_type).workspace;
    // Scratch 编辑器需要固定一屏；building_3d 在移动端交给页面自然滚动，
    // 让教案内容完整展开、3D 画布给固定高度，避免一屏塞不下导致内容被截。
    const usesFixedMobileWorkspace = lessonWorkspace === "scratch";

    const focusLessonStepFromTutorTool = useCallback((toolCall: TutorToolCall) => {
        if (toolCall.name !== "course.focus_lesson_step" && toolCall.name !== "course.highlight_scratch_blocks") return;
        if (toolCall.payload.lessonId !== lesson.id) return;

        const maxStepIndex = Math.max(steps.length - 1, 0);
        const targetIndex = Math.min(Math.max(toolCall.payload.stepIndex, 0), maxStepIndex);
        setActiveStep(targetIndex);
        setFocusedStep(targetIndex);
        if (toolCall.name === "course.highlight_scratch_blocks") {
            const keywords = toolCall.payload.keywords.slice(0, 4);
            const items = toolCall.payload.items?.slice(0, 4);
            const targetCount = getHintTargetCount({ keywords, items });
            const hasToolTargetIndex =
                typeof toolCall.payload.targetItemIndex === "number" &&
                Number.isFinite(toolCall.payload.targetItemIndex);
            const toolTargetIndex = hasToolTargetIndex
                ? clampHintTargetIndex(toolCall.payload.targetItemIndex, targetCount)
                : undefined;
            setScratchBlockHint((current) => {
                const shouldReuse = shouldReuseScratchHintTarget(
                    current,
                    { ...toolCall.payload, stepIndex: targetIndex },
                    toolTargetIndex,
                );
                const nextTargetIndex = shouldReuse
                    ? clampHintTargetIndex((current?.targetItemIndex ?? 0) + 1, targetCount)
                    : toolTargetIndex ?? clampHintTargetIndex(0, targetCount);

                return {
                    stepIndex: targetIndex,
                    keywords,
                    items,
                    targetItemIndex: nextTargetIndex,
                    category: toolCall.payload.category,
                    reason: toolCall.payload.reason,
                };
            });
        }

        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => {
            setFocusedStep(null);
            focusTimerRef.current = null;
        }, 3600);
    }, [lesson.id, steps.length]);
    const sceneCapabilities = useMemo(
        () =>
            getTutorSceneCapabilities({
                focusCourseLessonStep: focusLessonStepFromTutorTool,
            }),
        [focusLessonStepFromTutorTool],
    );

    useEffect(() => {
        return registerToolHandlers({
            focusCourseLessonStep: focusLessonStepFromTutorTool,
        });
    }, [focusLessonStepFromTutorTool, registerToolHandlers]);

    useEffect(() => {
        setTutorOverride({
            subtitle: activeStepTitle ? `正在做「${activeStepTitle}」` : lesson.title,
            lessonStepIndex: clampedActiveStep,
            lessonStepCount: steps.length,
            scratchBlockTargetItemIndex:
                scratchBlockHint?.stepIndex === clampedActiveStep
                    ? scratchBlockHint.targetItemIndex
                    : undefined,
            scratchEditorContext,
            sceneCapabilities,
            quickPrompts: ["这一步怎么做？", "我卡住了", "下一步该做什么？"],
        });

        return () => {
            clearTutorOverride();
        };
    }, [
        activeStepTitle,
        clampedActiveStep,
        clearTutorOverride,
        lesson.title,
        scratchBlockHint,
        scratchEditorContext,
        sceneCapabilities,
        setTutorOverride,
        steps.length,
    ]);

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
                "mx-auto flex w-full flex-col app-canvas",
                usesFixedMobileWorkspace ? "overflow-hidden" : "overflow-x-hidden overflow-y-visible md:overflow-hidden",
                usesFixedMobileWorkspace ? FIXED_LESSON_PAGE_HEIGHT : SCROLL_LESSON_PAGE_HEIGHT,
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
                        usesFixedMobileWorkspace
                            ? "max-lg:max-h-[min(48vh,28rem)] max-lg:min-h-0 max-lg:shrink-0 max-lg:overflow-hidden"
                            : "max-lg:shrink-0 max-lg:overflow-visible",
                        "max-lg:order-2 max-lg:border-b",
                        "lg:order-none lg:min-h-0 lg:max-h-none lg:shrink-0",
                        // playground 课时在移动端用单栏：讲解+实战都由 PlaygroundWorkspace 承载，
                        // 不再额外渲染左侧步骤列表，避免与工作区讲解重复堆叠。
                        lessonWorkspace === "playground" && "max-lg:hidden",
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
                        compactSteps={lessonWorkspace === "playground"}
                    />
                </div>
                <div
                    className={cn(
                        "flex min-w-0 flex-1 flex-col max-lg:order-1 lg:order-none",
                        usesFixedMobileWorkspace ? "min-h-0" : "min-h-[60vh] md:min-h-0",
                        // building_3d 在移动端不参与 flex 撑满，3D 画布用固定 dvh 高度，
                        // 避免可滚动布局下 flex-1 高度波动触发 ResizeObserver 反复 setSize 闪烁。
                        lessonWorkspace === "building_3d" && "max-lg:flex-none",
                    )}
                >
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

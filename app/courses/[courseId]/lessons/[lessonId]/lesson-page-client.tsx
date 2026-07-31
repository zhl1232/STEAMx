"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
    buildScratchBlockHintItems,
    resolveScratchBlockCategory,
    type ScratchBlockHintItem,
} from "@/lib/courses/scratch-hints";
import type { ScratchEditorContext } from "@/lib/courses/scratch-messages";
import {
    buildScratchStepCheck,
    type ScratchStepCheckResult,
} from "@/lib/courses/scratch-step-check";
import { buildBuildingLessonDisplaySteps } from "@/lib/courses/building-lesson-flow";
import type { CourseLessonRow } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/** 交互式编辑/搭建课需要固定工作区；阅读型 playground 课在移动端应交给页面自然滚动。 */
const FIXED_LESSON_PAGE_HEIGHT = "max-md:h-dvh md:h-[calc(100dvh-4rem)]";
const SCROLL_LESSON_PAGE_HEIGHT = "max-md:min-h-screen md:h-[calc(100dvh-4rem)]";
const BUILDING_STEP_QUERY_PARAM = "step";

function clampStepIndex(index: number, stepCount: number) {
    if (stepCount <= 0) return 0;
    return Math.min(Math.max(Math.trunc(index), 0), stepCount - 1);
}

function readBuildingStepFromUrl(stepCount: number) {
    const rawStep = new URLSearchParams(window.location.search).get(BUILDING_STEP_QUERY_PARAM);
    const routeStep = rawStep && /^\d+$/.test(rawStep) ? Number(rawStep) : 1;
    return clampStepIndex(routeStep - 1, stepCount);
}

function replaceBuildingStepInUrl(stepIndex: number) {
    const url = new URL(window.location.href);
    url.searchParams.set(BUILDING_STEP_QUERY_PARAM, String(stepIndex + 1));
    window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
}

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
    initialStepIndex = 0,
}: {
    courseId: number;
    courseTitle: string;
    lesson: CourseLessonRow;
    previewHref: string;
    initialCompleted?: boolean;
    initialStepIndex?: number;
}) {
    const router = useRouter();
    const lessonWorkspace = getLessonTypeDefinition(lesson.lesson_type).workspace;
    const steps = useMemo(
        () => lessonWorkspace === "building_3d"
            ? buildBuildingLessonDisplaySteps({
                lessonTitle: lesson.title,
                content: lesson.content?.building3d,
            })
            : lesson.steps ?? [],
        [lesson.content?.building3d, lesson.steps, lesson.title, lessonWorkspace],
    );
    const [activeStep, setActiveStep] = useState(() =>
        lessonWorkspace === "building_3d"
            ? clampStepIndex(initialStepIndex, steps.length)
            : 0,
    );
    const [completed, setCompleted] = useState(initialCompleted);
    const [focusedStep, setFocusedStep] = useState<number | null>(null);
    const [scratchBlockHint, setScratchBlockHint] = useState<ScratchWorkspaceBlockHint | null>(null);
    const [scratchStepCheckResult, setScratchStepCheckResult] = useState<ScratchStepCheckResult | null>(null);
    const [scratchEditorContext, setScratchEditorContext] = useState<ScratchEditorContext | null>(null);
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { registerToolHandlers, setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext();
    const clampedActiveStep = clampStepIndex(activeStep, steps.length);
    const activeStepTitle = steps[clampedActiveStep]?.title;
    // Scratch 编辑器需要固定一屏；building_3d 在移动端交给页面自然滚动，
    // 让教案内容完整展开、3D 画布给固定高度，避免一屏塞不下导致内容被截。
    const usesFixedMobileWorkspace = lessonWorkspace === "scratch";

    const handleStepChange = useCallback((index: number) => {
        const nextStep = clampStepIndex(index, steps.length);
        setActiveStep(nextStep);
        if (lessonWorkspace === "building_3d") {
            replaceBuildingStepInUrl(nextStep);
        }
    }, [lessonWorkspace, steps.length]);

    useEffect(() => {
        if (lessonWorkspace !== "building_3d") return;
        const lessonPath = `/courses/${courseId}/lessons/${lesson.id}`;

        const restoreStepFromUrl = () => {
            if (window.location.pathname !== lessonPath) return;
            const routeStep = readBuildingStepFromUrl(steps.length);
            setActiveStep(routeStep);
            replaceBuildingStepInUrl(routeStep);
        };

        restoreStepFromUrl();
        window.addEventListener("popstate", restoreStepFromUrl);
        return () => window.removeEventListener("popstate", restoreStepFromUrl);
    }, [courseId, lesson.id, lessonWorkspace, steps.length]);

    const handleScratchEditorContextChange = useCallback((context: ScratchEditorContext) => {
        setScratchEditorContext(context);
        setScratchStepCheckResult(null);
    }, []);

    const runScratchStepCheck = useCallback(() => {
        const currentStep = steps[clampedActiveStep] ?? null;
        setScratchStepCheckResult(
            buildScratchStepCheck({
                step: currentStep,
                lessonContent: lesson.content,
                editorContext: scratchEditorContext,
            }),
        );
    }, [clampedActiveStep, lesson.content, scratchEditorContext, steps]);

    const focusScratchStepCheckItem = useCallback((targetItemIndex: number) => {
        const currentStep = steps[clampedActiveStep] ?? null;
        const items = scratchStepCheckResult?.items.map((result) => result.item) ??
            buildScratchBlockHintItems({
                step: currentStep,
                lessonContent: lesson.content,
                maxItems: 8,
            });
        const targetItem = items[targetItemIndex];
        if (!targetItem) return;

        const keywords = [...new Set(items.map((item) => item.findLabel).filter(Boolean))];
        setScratchBlockHint({
            stepIndex: clampedActiveStep,
            keywords,
            items,
            targetItemIndex,
            category: targetItem.category ?? resolveScratchBlockCategory([targetItem.findLabel]),
            reason: "review",
        });
        setFocusedStep(clampedActiveStep);
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => {
            setFocusedStep(null);
            focusTimerRef.current = null;
        }, 3600);
    }, [clampedActiveStep, lesson.content, scratchStepCheckResult, steps]);

    const focusLessonStepFromTutorTool = useCallback((toolCall: TutorToolCall) => {
        if (toolCall.name !== "course.focus_lesson_step" && toolCall.name !== "course.highlight_scratch_blocks") return;
        if (toolCall.payload.lessonId !== lesson.id) return;

        const maxStepIndex = Math.max(steps.length - 1, 0);
        const targetIndex = Math.min(Math.max(toolCall.payload.stepIndex, 0), maxStepIndex);
        handleStepChange(targetIndex);
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
    }, [handleStepChange, lesson.id, steps.length]);
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
        setScratchStepCheckResult(null);
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
                        "lg:order-0 lg:min-h-0 lg:max-h-none lg:shrink-0",
                        // playground 与积木课在移动端都由工作区承载翻页，隐藏重复的侧栏步骤。
                        (lessonWorkspace === "playground" || lessonWorkspace === "building_3d") && "max-lg:hidden",
                    )}
                >
                    <LessonSidebar
                        courseId={courseId}
                        courseTitle={courseTitle}
                        lesson={lesson}
                        displaySteps={steps}
                        activeStepIndex={clampedActiveStep}
                        focusedStepIndex={focusedStep}
                        onStepClick={handleStepChange}
                        completed={completed}
                        compactSteps={lessonWorkspace === "playground"}
                    />
                </div>
                <div
                    className={cn(
                        "flex min-w-0 flex-1 flex-col max-lg:order-1 lg:order-0",
                        usesFixedMobileWorkspace || lessonWorkspace === "building_3d"
                            ? "min-h-0"
                            : "min-h-[60vh] md:min-h-0",
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
                        scratchStepCheckResult={scratchStepCheckResult}
                        onDismissScratchBlockHint={() => setScratchBlockHint(null)}
                        onCheckScratchStep={lessonWorkspace === "scratch" ? runScratchStepCheck : undefined}
                        onFocusScratchStepCheckItem={focusScratchStepCheckItem}
                        onScratchEditorContextChange={handleScratchEditorContextChange}
                        onStepChange={handleStepChange}
                        initialCompleted={initialCompleted}
                        onCompleted={() => {
                            setCompleted(true);
                            router.refresh();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

"use client";
import type { LessonCompletionResult } from "@/components/features/courses/lesson-completion-dialog";

import { Play, Smartphone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
    Building3DWorkspace,
    UnsupportedLessonWorkspace,
} from "@/components/features/courses/building-3d-workspace";
import {
    ScratchWorkspace,
    type ScratchWorkspaceBlockHint,
} from "@/components/features/courses/scratch-workspace";
import { PlaygroundWorkspace } from "@/components/features/courses/playground-workspace";
import { TextbookLessonWorkspace } from "@/components/features/courses/textbook-lesson-workspace";
import { Button } from "@/components/ui/button";
import type { ScratchEditorContext } from "@/lib/courses/scratch-messages";
import { getLessonTypeDefinition } from "@/lib/courses/lesson-types";
import type { CourseLessonRow } from "@/lib/courses/types";
import { isWorkSubmissionEnabled } from "@/lib/works/capability";
import { LessonWorkUpload } from "@/components/features/courses/lesson-work-upload";
import type { ScratchStepCheckResult } from "@/lib/courses/scratch-step-check";

export function LessonWorkspaceRenderer({
    courseId,
    lesson,
    previewHref,
    activeStepIndex,
    scratchBlockHint,
    scratchStepCheckResult,
    onDismissScratchBlockHint,
    onCheckScratchStep,
    onFocusScratchStepCheckItem,
    onScratchEditorContextChange,
    onStepChange,
    initialCompleted,
    onCompleted,
    buildingNavigationSlot,
    buildingVoiceControlsSlot,
    buildingMobileHeaderSlot,
    buildingSidebar,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    previewHref: string;
    activeStepIndex: number;
    scratchBlockHint?: ScratchWorkspaceBlockHint | null;
    scratchStepCheckResult?: ScratchStepCheckResult | null;
    onDismissScratchBlockHint?: () => void;
    onCheckScratchStep?: () => void;
    onFocusScratchStepCheckItem?: (targetItemIndex: number) => void;
    onScratchEditorContextChange?: (context: ScratchEditorContext) => void;
    onStepChange: (index: number) => void;
    initialCompleted: boolean;
    onCompleted: (result: LessonCompletionResult) => void;
    buildingNavigationSlot?: ReactNode;
    buildingVoiceControlsSlot?: ReactNode;
    buildingMobileHeaderSlot?: ReactNode;
    buildingSidebar?: { collapsed: boolean; onToggle: () => void };
}) {
    const lessonType = getLessonTypeDefinition(lesson.lesson_type);

    if (lessonType.workspace === "scratch") {
        const scratch = lesson.content?.scratch;
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 md:hidden">
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
                {scratch?.referenceProjectUrl ? (
                    <div className="flex shrink-0 justify-end border-b border-border bg-card px-3 py-1.5">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`${previewHref}?source=reference`} prefetch={false} target="_blank" rel="noopener noreferrer">
                                <Play className="mr-1 h-4 w-4" aria-hidden />
                                查看积木示例
                            </Link>
                        </Button>
                    </div>
                ) : null}
                <ScratchWorkspace
                    courseId={courseId}
                    lessonId={lesson.id}
                    starterProjectUrl={scratch?.starterProjectUrl}
                    referenceProjectUrl={scratch?.referenceProjectUrl}
                    tutorialDeckId={
                        typeof lesson.content?.tutorialDeckId === "string"
                            ? lesson.content.tutorialDeckId
                            : undefined
                    }
                    initialCompleted={initialCompleted}
                    blockHint={scratchBlockHint}
                    onDismissBlockHint={onDismissScratchBlockHint}
                    stepCheckResult={scratchStepCheckResult}
                    onCheckCurrentStep={onCheckScratchStep}
                    onFocusStepCheckItem={onFocusScratchStepCheckItem}
                    onEditorContextChange={onScratchEditorContextChange}
                    onCompleted={onCompleted}
                />
                {isWorkSubmissionEnabled(lesson) ? (
                    <div className="shrink-0 border-t border-border bg-card px-3 py-2">
                        <div className="ml-auto w-full sm:w-48">
                            <LessonWorkUpload
                                courseId={courseId}
                                lessonId={lesson.id}
                                lessonTitle={lesson.title}
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    if (lessonType.workspace === "building_3d") {
        return (
            <Building3DWorkspace
                navigationSlot={buildingNavigationSlot}
                voiceControlsSlot={buildingVoiceControlsSlot}
                mobileHeaderSlot={buildingMobileHeaderSlot}
                sidebar={buildingSidebar}
                courseId={courseId}
                lesson={lesson}
                activeStepIndex={activeStepIndex}
                onStepChange={onStepChange}
                initialCompleted={initialCompleted}
                onCompleted={onCompleted}
            />
        );
    }

    if (lessonType.workspace === "playground") {
        return (
            <PlaygroundWorkspace
                courseId={courseId}
                lesson={lesson}
                activeStepIndex={activeStepIndex}
                onStepChange={onStepChange}
                initialCompleted={initialCompleted}
                onCompleted={onCompleted}
            />
        );
    }

    if (lessonType.workspace === "textbook") {
        return (
            <TextbookLessonWorkspace
                courseId={courseId}
                lesson={lesson}
                initialCompleted={initialCompleted}
                onCompleted={onCompleted}
            />
        );
    }

    return <UnsupportedLessonWorkspace lessonType={lesson.lesson_type} />;
}

"use client";

import { Smartphone } from "lucide-react";
import Link from "next/link";

import {
    Building3DWorkspace,
    UnsupportedLessonWorkspace,
} from "@/components/features/courses/building-3d-workspace";
import { ScratchWorkspace } from "@/components/features/courses/scratch-workspace";
import { Button } from "@/components/ui/button";
import { getLessonTypeDefinition } from "@/lib/courses/lesson-types";
import { canUseScratchEditor } from "@/lib/courses/device";
import type { CourseLessonRow } from "@/lib/courses/types";

export function LessonWorkspaceRenderer({
    courseId,
    lesson,
    previewHref,
    activeStepIndex,
    onStepChange,
    initialCompleted,
    onCompleted,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    previewHref: string;
    activeStepIndex: number;
    onStepChange: (index: number) => void;
    initialCompleted: boolean;
    onCompleted: () => void;
}) {
    const lessonType = getLessonTypeDefinition(lesson.lesson_type);

    if (lessonType.workspace === "scratch") {
        const showEditor = canUseScratchEditor();
        return (
            <>
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
                    onCompleted={onCompleted}
                />
            </>
        );
    }

    if (lessonType.workspace === "building_3d") {
        return (
            <Building3DWorkspace
                courseId={courseId}
                lesson={lesson}
                activeStepIndex={activeStepIndex}
                onStepChange={onStepChange}
                initialCompleted={initialCompleted}
                onCompleted={onCompleted}
            />
        );
    }

    return <UnsupportedLessonWorkspace lessonType={lesson.lesson_type} />;
}

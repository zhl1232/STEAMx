"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { readLastLessonVisit, type LastLessonVisit } from "@/lib/courses/lesson-step-memory";

/**
 * 课程页「继续上次」：读本机记住的最后一节课和页码，直接回到那一页。
 * 只有记录里的页码大于第 1 页时才出现，避免和「开始/继续 第 N 课」重复。
 */
export function ContinueLastLesson({
    courseId,
    lessonIds,
    fallback = null,
}: {
    courseId: number;
    lessonIds: number[];
    fallback?: ReactNode;
}) {
    const [visit, setVisit] = useState<LastLessonVisit | null>(null);
    const lessonKey = lessonIds.join(",");

    useEffect(() => {
        const last = readLastLessonVisit(courseId);
        const ids = lessonKey.split(",").map(Number);
        setVisit(last && last.stepIndex > 0 && ids.includes(last.lessonId) ? last : null);
    }, [courseId, lessonKey]);

    if (!visit) return fallback;
    const lessonNumber = lessonIds.indexOf(visit.lessonId) + 1;

    return (
        <Link
            href={`/courses/${courseId}/lessons/${visit.lessonId}?step=${visit.stepIndex + 1}`}
            prefetch={false}
            data-testid="continue-last-lesson"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
            <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            继续上次：第 {lessonNumber} 课第 {visit.stepIndex + 1} 页
        </Link>
    );
}

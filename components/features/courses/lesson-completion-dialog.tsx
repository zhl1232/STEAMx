"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export interface LessonCompletionResult {
    alreadyCompleted?: boolean;
    courseCompletionState?: "not_complete" | "created" | "already_recorded" | "configuration_error";
    courseProgress?: {
        completedLessonCount?: number;
        totalLessonCount?: number;
        nextLessonId?: number | null;
    } | null;
}

/** 课时完成后的收尾弹层：一句鼓励 + 下一课（或结课凭证）+ 回课程。 */
export function LessonCompletionDialog({
    open,
    onOpenChange,
    courseId,
    result,
    uploadWorkHref = null,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: number;
    result: LessonCompletionResult | null;
    /** 本课支持上传作品时给出「上传我的作品」 */
    uploadWorkHref?: string | null;
}) {
    const progress = result?.courseProgress ?? null;
    const courseDone = result?.courseCompletionState === "created";
    const nextLessonId = progress?.nextLessonId ?? null;
    const done = progress?.completedLessonCount;
    const total = progress?.totalLessonCount;
    const progressText = typeof done === "number" && typeof total === "number" && total > 0
        ? `本门课已完成 ${done}/${total} 课。`
        : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm" data-testid="lesson-completion-dialog">
                <DialogHeader className="items-center text-center sm:text-center">
                    <PartyPopper className="h-10 w-10 text-[hsl(var(--nav-active))]" aria-hidden />
                    <DialogTitle className="text-xl">{courseDone ? "整门课都学完啦！" : "你完成啦！"}</DialogTitle>
                    <DialogDescription>
                        {courseDone ? "结课凭证和作品册已经生成。" : `进度已保存。${progressText}`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
                    {courseDone ? (
                        <Button asChild className="h-11 w-full">
                            <Link href={`/courses/${courseId}/certificate`} prefetch={false}>看结课凭证</Link>
                        </Button>
                    ) : nextLessonId ? (
                        <Button asChild className="h-11 w-full">
                            <Link href={`/courses/${courseId}/lessons/${nextLessonId}`} prefetch={false}>学下一课</Link>
                        </Button>
                    ) : null}
                    {uploadWorkHref ? (
                        <Button asChild variant="outline" className="h-11 w-full">
                            <a href={uploadWorkHref}>上传我的作品</a>
                        </Button>
                    ) : null}
                    <Button asChild variant="ghost" className="h-11 w-full">
                        <Link href={`/courses/${courseId}`} prefetch={false}>回到课程</Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BookOpen } from "lucide-react";

import TextbookFrame from "@/components/features/textbook3d/textbook-frame";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import { getLessonCompletionFeedback } from "@/lib/courses/progress";
import type { CourseLessonRow } from "@/lib/courses/types";
import { getTextbook3dLesson, resolveTextbook3dLessonId, textbook3dSrc } from "@/lib/textbook3d/registry";
import { toLessonCompletionToast } from "./lesson-completion-toast";
import type { LessonCompletionResult } from "./lesson-completion-dialog";

/**
 * textbook_3d 课时：嵌入 3D 课本，课本里完成课末挑战时通过现有的完成接口记一次完成。
 * 未登录时弹登录框，不记录；课号没登记时显示说明而不是空白。
 */
export function TextbookLessonWorkspace({
    courseId,
    lesson,
    initialCompleted,
    onCompleted,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    initialCompleted?: boolean;
    onCompleted?: (result: LessonCompletionResult) => void;
}) {
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();
    const [completed, setCompleted] = useState(Boolean(initialCompleted));
    const sending = useRef(false);
    const textbookId = resolveTextbook3dLessonId(lesson.content?.textbook3d?.lessonId);
    const textbook = textbookId ? getTextbook3dLesson(textbookId) : null;

    const handleComplete = useCallback(async () => {
        if (completed || sending.current) return;
        if (!user) {
            promptLogin();
            return;
        }
        sending.current = true;
        try {
            const res = await fetch(`/api/courses/${courseId}/lessons/${lesson.id}/complete`, { method: "POST" });
            const data = (await res.json().catch(() => ({}))) as LessonCompletionResult & { error?: string };
            if (!res.ok) throw new Error(data.error || "完成失败");
            setCompleted(true);
            if (onCompleted) onCompleted(data);
            else toast(toLessonCompletionToast(getLessonCompletionFeedback({ ...data, courseId })));
        } catch (error) {
            toast({
                title: "完成没有记上",
                description: error instanceof Error ? error.message : undefined,
                variant: "destructive",
            });
        } finally {
            sending.current = false;
        }
    }, [completed, courseId, lesson.id, onCompleted, promptLogin, toast, user]);

    if (!textbookId || !textbook) {
        return (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-base text-muted-foreground">
                这节课还没有配置 3D 课本内容，请联系老师。
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-foreground">
                    {completed ? "本课已完成，可以继续复习。" : "看完演示，完成课本最后的挑战，就会记为完成本课。"}
                </p>
                <Link
                    href={`/textbook/${textbookId}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                    <BookOpen className="h-4 w-4" aria-hidden />
                    单独打开课本
                </Link>
            </div>
            <TextbookFrame
                lessonId={textbookId}
                src={textbook3dSrc(textbookId)}
                title={`3D 课本：${textbook.title}`}
                onComplete={handleComplete}
            />
        </div>
    );
}

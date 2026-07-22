"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";

const CompleteProjectDialog = dynamic(
    () => import("@/components/features/project/complete-project-dialog").then((module) => module.CompleteProjectDialog),
    { ssr: false },
);

/**
 * 课时作品直接提交到课时来源，复用统一作品上传体验和审核链路。
 */
export function LessonWorkUpload({
    courseId,
    lessonId,
    lessonTitle,
    onUploaded,
}: {
    courseId: number;
    lessonId: number;
    lessonTitle: string;
    onUploaded?: () => void;
}) {
    const router = useRouter();
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                    if (!user) {
                        promptLogin();
                        return;
                    }
                    setOpen(true);
                }}
            >
                <ImagePlus className="mr-1 h-4 w-4" />
                上传我的作品
            </Button>

            {open ? (
                <CompleteProjectDialog
                    projectTitle={lessonTitle}
                    submitEndpoint={`/api/courses/${courseId}/lessons/${lessonId}/works`}
                    mode="final"
                    open={open}
                    onOpenChange={setOpen}
                    onSuccess={(result) => {
                        onUploaded?.();
                        router.push(`/works/${result.id}?share=1`);
                    }}
                />
            ) : null}
        </>
    );
}

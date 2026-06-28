"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";

import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import { ProjectProvider } from "@/lib/context/project-context";

/**
 * 课时「上传作品」入口：搭完后把实物照片提交到背书项目（worksProjectId），
 * 复用项目侧的 CompleteProjectDialog → /api/projects/[id]/completions（含图片上传/AI 审核/社区展示）。
 *
 * 课程页不在全局 ProjectProvider 范围内，故仅在打开弹窗时局部挂一个 ProjectProvider，
 * 既满足 CompleteProjectDialog 对 useProjects() 的依赖，又避免在每个课时常驻加载项目数据。
 */
export function LessonWorkUpload({
    projectId,
    projectTitle,
    onUploaded,
}: {
    projectId: number;
    projectTitle: string;
    onUploaded?: () => void;
}) {
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
                <ProjectProvider>
                    <CompleteProjectDialog
                        projectId={projectId}
                        projectTitle={projectTitle}
                        mode="final"
                        open={open}
                        onOpenChange={setOpen}
                        onSuccess={() => {
                            setOpen(false);
                            onUploaded?.();
                        }}
                    />
                </ProjectProvider>
            ) : null}
        </>
    );
}

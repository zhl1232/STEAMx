"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProjects } from '@/lib/context/project-context'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"

interface CompletionCTAProps {
    projectId: number | string
    projectTitle: string
    challengeId?: number | null
    mode?: "project" | "observation"
    variant?: "card" | "inline"
}

export function CompletionCTA({ projectId, projectTitle, challengeId, mode = "project", variant = "card" }: CompletionCTAProps) {
    const router = useRouter()
    const { isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showDialog, setShowDialog] = useState(false)

    if (isCompleted(projectId)) return null

    const handleClick = () => {
        if (mode === "observation") {
            if (!user) {
                promptLogin(() => router.push("/nature/submit"), {
                    title: "登录以完成观察记录",
                    description: "登录后可提交你的观察记录，形成真实世界的观察沉淀",
                })
                return
            }
            router.push("/nature/submit")
            return
        }

        if (!user) {
            promptLogin(() => setShowDialog(true), {
                title: "登录以上传作品",
                description: "登录后可上传你的作品，获得 XP 和成就徽章",
            })
            return
        }
        setShowDialog(true)
    }

    const actionLabel = mode === "observation" ? "提交这次观察" : "上传我的作品"

    if (variant === "inline") {
        return (
            <>
                <Button onClick={handleClick} className="h-9 gap-2 rounded-[8px] px-4">
                    <Camera className="h-4 w-4" />
                    {actionLabel}
                </Button>
                {mode === "project" && (
                    <CompleteProjectDialog
                        projectId={projectId}
                        projectTitle={projectTitle}
                        challengeId={challengeId}
                        open={showDialog}
                        onOpenChange={setShowDialog}
                        onSuccess={() => router.refresh()}
                    />
                )}
            </>
        )
    }

    return (
        <>
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                <p className="text-lg font-semibold">
                    {mode === "observation" ? "准备把这次观察记录下来了吗？" : "你也完成了这个项目吗？"}
                </p>
                <p className="text-sm text-muted-foreground">
                    {mode === "observation"
                        ? <>完成一条结构化观察记录，让这次任务真正沉淀成可检索的自然观察内容。</>
                        : <>上传作品照片或视频，审核通过后可获得 <span className="font-semibold text-primary">20 XP</span> 和社区认可</>
                    }
                </p>
                <Button onClick={handleClick} className="gap-2">
                    <Camera className="h-4 w-4" />
                    {actionLabel}
                </Button>
            </div>
            {mode === "project" && (
                <CompleteProjectDialog
                    projectId={projectId}
                    projectTitle={projectTitle}
                    challengeId={challengeId}
                    open={showDialog}
                    onOpenChange={setShowDialog}
                    onSuccess={() => router.refresh()}
                />
            )}
        </>
    )
}

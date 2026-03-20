"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { CompleteProjectDialog } from "@/components/features/project/complete-project-dialog"

interface CompletionCTAProps {
    projectId: number | string
    projectTitle: string
    challengeId?: number | null
}

export function CompletionCTA({ projectId, projectTitle, challengeId }: CompletionCTAProps) {
    const router = useRouter()
    const { isCompleted } = useProjects()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const [showDialog, setShowDialog] = useState(false)

    if (isCompleted(projectId)) return null

    const handleClick = () => {
        if (!user) {
            promptLogin(() => setShowDialog(true), {
                title: "登录以上传作品",
                description: "登录后可上传你的作品，获得 XP 和成就徽章",
            })
            return
        }
        setShowDialog(true)
    }

    return (
        <>
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                <p className="text-lg font-semibold">你也完成了这个项目吗？</p>
                <p className="text-sm text-muted-foreground">
                    上传作品照片或视频，审核通过后可获得 <span className="font-semibold text-primary">20 XP</span> 和社区认可
                </p>
                <Button onClick={handleClick} className="gap-2">
                    <Camera className="h-4 w-4" />
                    上传我的作品
                </Button>
            </div>
            <CompleteProjectDialog
                projectId={projectId}
                projectTitle={projectTitle}
                challengeId={challengeId}
                open={showDialog}
                onOpenChange={setShowDialog}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}

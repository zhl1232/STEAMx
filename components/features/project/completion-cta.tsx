"use client"

import { useRouter } from "next/navigation"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'

interface CompletionCTAProps {
    actionLabel?: string
    projectId: number | string
    projectTitle: string
    challengeId?: number | null
    mode?: "project" | "observation"
    variant?: "card" | "inline" | "records"
}

export function CompletionCTA({ projectId, mode = "project", variant = "card", actionLabel: actionLabelProp }: CompletionCTAProps) {
    const router = useRouter()
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()

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
            promptLogin(() => router.push(`/project/${projectId}/records`), {
                title: "登录以开始我的项目",
                description: "登录后按步骤记录过程，最后提交自己的作品",
            })
            return
        }
        router.push(`/project/${projectId}/records`)
    }

    const actionLabel = actionLabelProp ?? (mode === "observation" ? "提交这次观察" : "开始我的项目")

    if (variant === "records") {
        return (
            <Button
                    type="button"
                    variant="outline"
                    onClick={handleClick}
                    className="h-9 shrink-0 gap-1.5 rounded-sm border-[hsl(var(--brand-green))] bg-background/80 px-3 text-sm font-semibold text-[hsl(var(--brand-green))] hover:bg-[hsl(var(--brand-green)/0.08)]"
                >
                    <Camera className="h-4 w-4" />
                    {actionLabel}
                    </Button>
        )
    }

    if (variant === "inline") {
        return (
            <Button onClick={handleClick} className="h-9 gap-2 px-4">
                    <Camera className="h-4 w-4" />
                    {actionLabel}
                </Button>
        )
    }

    return (
        <div className="rounded-sm border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                <p className="text-lg font-semibold">
                    {mode === "observation" ? "准备把这次观察记录下来了吗？" : "想把这个项目做成自己的作品吗？"}
                </p>
                <p className="text-sm text-muted-foreground">
                    {mode === "observation"
                        ? <>完成一条结构化观察记录，让这次任务真正沉淀成可检索的自然观察内容。</>
                        : <>先开始一次自己的项目尝试，按步骤记录过程，最后提交作品并获得 <span className="font-semibold text-primary">20 XP</span></>
                    }
                </p>
                <Button onClick={handleClick} className="gap-2">
                    <Camera className="h-4 w-4" />
                    {actionLabel}
                </Button>
            </div>
    )
}

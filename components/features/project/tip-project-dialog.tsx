"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Coins, User as UserIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useGamification } from "@/context/gamification-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { useToast } from "@/hooks/use-toast"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProjectCompletion } from "@/lib/mappers/types"

interface TipProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  completions: ProjectCompletion[]
  projectTitle: string
  projectOwnerId: string
  projectId: string | number
  /** 为 true 时仅展示「投给项目」入口（如底部栏），不展示完成作品列表 */
  projectOnly?: boolean
}

type TipTarget = {
  type: 'project' | 'completion'
  id: number // strict number for DB
  userId: string
  label: string
  desc?: string
}

export function TipProjectDialog({
  open,
  onOpenChange,
  completions,
  projectTitle,
  projectOwnerId,
  projectId,
  projectOnly = false,
}: TipProjectDialogProps) {
  const supabase = createClient()
  const { user, refreshProfile } = useAuth()
  const { coins = 0 } = useGamification()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  // 构建打赏目标列表
  const targets: TipTarget[] = []

  // 1. 项目作者 (如果不是自己)
  if (user && projectOwnerId !== user.id) {
    targets.push({
      type: 'project',
      id: Number(projectId),
      userId: projectOwnerId,
      label: `项目作者`,
      desc: projectOnly ? '投币支持本项目' : '感谢项目的创意与分享',
    })
  }

  // 2. 完成作品作者 (仅当非 projectOnly 时展示)
  if (!projectOnly) {
    completions.forEach((c) => {
      if (user && c.userId !== user.id) {
        targets.push({
          type: 'completion',
          id: c.id,
          userId: c.userId,
          label: c.author,
          desc: '完成作品',
        })
      }
    })
  }

  // 统一打赏处理
  const handleTip = (target: TipTarget, amount: number) => {
    if (!user) {
      promptLogin(() => {}, { title: "投币", description: "登录后即可用硬币赞赏" })
      return
    }

    supabase.rpc("tip_resource", {
      p_resource_type: target.type,
      p_resource_id: target.id,
      p_amount: amount
    } as never)
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          toast({ variant: "destructive", title: "投币失败", description: error.message })
          return
        }
        const res = data as { ok?: boolean; error?: string }
        if (res?.ok) {
          queryClient.invalidateQueries({ queryKey: ["my_tip_for_resource", target.type, target.id] })
          if (target.type === "completion") {
            queryClient.invalidateQueries({ queryKey: ["completion_tip_received", target.id] })
          }
          queryClient.invalidateQueries({ queryKey: ["coin_logs"] })
          refreshProfile()
          router.refresh()
          toast({ title: "投币成功", description: `已赞赏 ${amount} 硬币` })
        } else {
          const msg = res?.error === "insufficient_coins" ? "硬币余额不足" : res?.error === "tip_limit_reached" ? "已达该对象投币上限" : res?.error === "cannot_tip_self" ? "不能给自己投币" : "投币失败"
          toast({ variant: "destructive", title: "投币失败", description: msg })
        }
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          {projectOnly ? '投币支持项目' : '为本项目投币'}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          {projectOnly
            ? <>投币给「{projectTitle}」的项目作者。每人对本项目最多投 2 硬币。</>
            : <>对「{projectTitle}」及完成作品赞赏。每人对每个对象最多投 2 硬币。</>}
          <br />
          当前余额：<strong>{coins}</strong> 硬币
        </p>

        {targets.length === 0 ? (
           <p className="text-sm text-muted-foreground py-4 text-center">
             {(!user || user.id === projectOwnerId)
               ? "不能给自己投币"
               : "暂无对象可赞赏"}
           </p>
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
            {targets.map((t) => (
              <TipRow
                key={`${t.type}-${t.id}`}
                target={t}
                coins={coins}
                onTip={handleTip}
                supabase={supabase}
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TipRow({
  target,
  coins,
  onTip,
  supabase,
}: {
  target: TipTarget
  coins: number
  onTip: (target: TipTarget, amount: number) => void
  supabase: ReturnType<typeof createClient>
}) {
  // 查询我看这个资源已经投了多少
  const { data: myTipped = 0 } = useQuery({
    queryKey: ["my_tip_for_resource", target.type, target.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_tip_for_resource", {
        p_resource_type: target.type,
        p_resource_id: target.id,
      } as never)
      if (error) return 0
      return (data as number) ?? 0
    },
  })

  const tipRemaining = Math.max(0, 2 - myTipped)
  const [pending, setPending] = useState(false)

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
            {target.type === 'project' && <UserIcon className="h-3 w-3 text-primary" />}
            <p className="font-medium text-sm truncate">{target.label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {target.desc} • 我已投 {myTipped}/2
        </p>
      </div>
      {tipRemaining > 0 ? (
        <div className="flex gap-1 shrink-0">
          {[1, 2].filter((a) => a <= tipRemaining && coins >= a).map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              className="gap-1 h-8 px-2"
              disabled={pending}
              onClick={() => {
                setPending(true)
                onTip(target, amount)
                setTimeout(() => setPending(false), 500)
              }}
            >
              <Coins className="h-3.5 w-3.5" />
              {amount}
            </Button>
          ))}
        </div>
      ) : (
          <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
              已达上限
          </span>
      )}
    </li>
  )
}


"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { User as UserIcon } from "lucide-react"
import { CoinIcon } from "@/components/icons/coin-icon"
import { useAuth } from '@/lib/context/auth-context'
import { useGamification } from '@/lib/context/gamification-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useToast } from "@/hooks/use-toast"
import { getApiErrorMessage } from "@/lib/utils/http"
import { useQuery, useQueryClient } from "@tanstack/react-query"

interface TipProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectTitle: string
  projectOwnerId: string
  projectId: string | number
  resourceType?: 'project' | 'completion'
}

type TipTarget = {
  id: number // strict number for DB
  label: string
  desc?: string
}

export function TipProjectDialog({
  open,
  onOpenChange,
  projectTitle,
  projectOwnerId,
  projectId,
  resourceType = 'project',
}: TipProjectDialogProps) {
  const { user, refreshProfile } = useAuth()
  const { coins = 0 } = useGamification()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  const target: TipTarget | null = user && projectOwnerId !== user.id
    ? {
        id: Number(projectId),
        label: resourceType === 'completion' ? '作品作者' : '项目作者',
        desc: resourceType === 'completion' ? '投币支持这件作品' : '投币支持本项目',
      }
    : null

  const handleTip = async (target: TipTarget, amount: number) => {
    if (!user) {
      promptLogin(() => {}, { title: "投币", description: "登录后即可用硬币赞赏" })
      return
    }

    try {
      const response = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId: target.id,
          amount,
        }),
      })

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "tip_failed"))
      }

      const res = await response.json() as { ok?: boolean; error?: string }
      if (!res?.ok) {
        throw new Error(res?.error || "tip_failed")
      }

      queryClient.invalidateQueries({ queryKey: ["tip_my", resourceType, target.id] })
      queryClient.invalidateQueries({ queryKey: ["coin_logs"] })
      refreshProfile()
      router.refresh()
      toast({ title: "投币成功", description: `已赞赏 ${amount} 硬币` })
    } catch (error) {
      const code = error instanceof Error ? error.message : "tip_failed"
      const msg = code === "insufficient_coins"
        ? "硬币余额不足"
        : code === "tip_limit_reached"
          ? "已达该对象投币上限"
          : code === "cannot_tip_self"
            ? "不能给自己投币"
            : code === "项目不存在" || code === "作品不存在"
              ? code
              : "投币失败"
      toast({ variant: "destructive", title: "投币失败", description: msg })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2">
          <CoinIcon className="h-5 w-5 text-amber-500" />
          {resourceType === 'completion' ? '投币支持作品' : '投币支持项目'}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          投币给「{projectTitle}」的{resourceType === 'completion' ? '作品作者' : '项目作者'}。每人最多投 2 硬币。
          <br />
          当前余额：<strong>{coins}</strong> 硬币
        </p>

        {!target ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {(!user || user.id === projectOwnerId)
              ? "不能给自己投币"
              : "暂无对象可赞赏"}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            <TipRow
              target={target}
              coins={coins}
              onTip={handleTip}
              resourceType={resourceType}
            />
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
  resourceType,
}: {
  target: TipTarget
  coins: number
  onTip: (target: TipTarget, amount: number) => void | Promise<void>
  resourceType: 'project' | 'completion'
}) {
  // 查询我看这个资源已经投了多少
  const { data: myTipped = 0 } = useQuery({
    queryKey: ["tip_my", resourceType, target.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        resourceType,
        resourceId: String(target.id),
      })
      const response = await fetch(`/api/tips/my?${params.toString()}`)
      if (!response.ok) {
        return 0
      }
      const payload = await response.json()
      return (payload?.myTipped as number) ?? 0
    },
  })

  const tipRemaining = Math.max(0, 2 - myTipped)
  const [pending, setPending] = useState(false)

  return (
    <li className="flex items-center justify-between gap-2 rounded-xs border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <UserIcon className="h-3 w-3 text-primary" />
          <p className="truncate text-sm font-medium">{target.label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {target.desc} • 我已投 {myTipped}/2
        </p>
      </div>
      {tipRemaining > 0 ? (
        <div className="flex shrink-0 gap-1">
          {[1, 2].filter((a) => a <= tipRemaining && coins >= a).map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2"
              disabled={pending}
              onClick={() => {
                setPending(true)
                onTip(target, amount)
                setTimeout(() => setPending(false), 500)
              }}
            >
              <CoinIcon className="h-3.5 w-3.5" />
              {amount}
            </Button>
          ))}
        </div>
      ) : (
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          已达上限
        </span>
      )}
    </li>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"

interface ObservationOwnerActionsProps {
  observationId: number
  ownerId: string
}

export function ObservationOwnerActions({ observationId, ownerId }: ObservationOwnerActionsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, refreshProfile } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted || !user || user.id !== ownerId) {
    return null
  }

  const handleDelete = async () => {
    const confirmed = window.confirm("删除后将回滚这条记录带来的经验和观察进度，确定继续吗？")
    if (!confirmed || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/observations/${observationId}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || "删除失败")
      }

      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ["gamification", "stats"] })
      await queryClient.invalidateQueries({ queryKey: ["gamification", "badges"] })
      toast({ title: "观察记录已删除", description: "相关经验和观察进度已同步回滚。" })
      router.push("/nature/observations")
      router.refresh()
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {isDeleting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          删除中...
        </>
      ) : (
        <>
          <Trash2 className="mr-2 h-4 w-4" />
          删除记录
        </>
      )}
    </Button>
  )
}

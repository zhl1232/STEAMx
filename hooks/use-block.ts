import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/hooks/use-toast'

type BlockStatus = {
  blocked: boolean
  blockedByMe?: boolean
  userId: string
}

export function useBlock(targetUserId: string | undefined) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const queryKey = ['block-status', targetUserId]

  const query = useQuery({
    queryKey,
    enabled: Boolean(targetUserId),
    queryFn: async (): Promise<BlockStatus> => {
      const response = await fetch(`/api/blocks?userId=${encodeURIComponent(targetUserId || '')}`)
      if (!response.ok) throw new Error('加载屏蔽状态失败')
      return response.json() as Promise<BlockStatus>
    },
  })

  const mutation = useMutation({
    mutationFn: async (currentlyBlockedByMe: boolean) => {
      if (!targetUserId) throw new Error('用户不存在')
      const response = await fetch(currentlyBlockedByMe ? `/api/blocks/${targetUserId}` : '/api/blocks', {
        method: currentlyBlockedByMe ? 'DELETE' : 'POST',
        headers: currentlyBlockedByMe ? undefined : { 'Content-Type': 'application/json' },
        body: currentlyBlockedByMe ? undefined : JSON.stringify({ blockedUserId: targetUserId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || '操作失败')
      }
      return !currentlyBlockedByMe
    },
    onSuccess: (blockedByMe) => {
      queryClient.setQueryData(queryKey, {
        blocked: blockedByMe,
        blockedByMe,
        userId: targetUserId,
      })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast({ title: blockedByMe ? '已屏蔽用户' : '已取消屏蔽' })
    },
    onError: (error: Error) => {
      toast({ title: '操作失败', description: error.message, variant: 'destructive' })
    },
  })

  return {
    blocked: query.data?.blocked ?? false,
    blockedByMe: query.data?.blockedByMe ?? false,
    isLoading: query.isLoading,
    isPending: mutation.isPending,
    toggleBlock: () => mutation.mutate(query.data?.blockedByMe ?? false),
  }
}

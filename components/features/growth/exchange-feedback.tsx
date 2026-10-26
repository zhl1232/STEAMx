'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/context/auth-context'
import { useToast } from '@/hooks/use-toast'
export type ExchangeFeedback = { id: number; qualified: boolean; award_event: number | null; xp: number }
export function GrowthQualityBadge({ qualified }: { qualified?: boolean }) {
  return qualified ? <span className="ml-2 inline-flex rounded border px-1.5 py-0.5 align-middle text-[10px] font-normal text-muted-foreground" title="依据当前内容的交流质量审核，不代表答案科学正确或官方背书">高质量回复</span> : null
}
export function ExchangeRewardHint() {
  return <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">有意义的提问、分享和建议，有机会获得经验奖励。</summary><p className="mt-1">经审核符合条件每次5经验；项目问答与作品交流合计每天最多5次，同一线程每天一次，上海时间结算。不设周上限。超过额度仍可显示质量标签；普通感谢和鼓励也欢迎。标签不代表答案正确性。</p></details>
}
export function shouldAnnounceExchange(item: ExchangeFeedback, submittedId: number | null) {
  return item.id === submittedId && item.qualified && item.xp === 5 && Number.isSafeInteger(item.award_event) && Number(item.award_event) > 0
}
export function useExchangeFeedback(type: 'comment' | 'project_comment', ids: number[], submitted: { id: number; at: number } | null) {
  const { user } = useAuth(); const { toast } = useToast()
  const key = [...new Set(ids)].sort((a,b) => a-b).slice(0,200).join(',')
  const { data = [] } = useQuery<ExchangeFeedback[]>({
    queryKey: ['exchange-feedback', type, key, user?.id], enabled: Boolean(key),
    queryFn: async () => { const r = await fetch(`/api/growth/feedback?type=${type}&ids=${key}`); if (!r.ok) return []; return (await r.json()).feedback || [] },
    refetchInterval: () => submitted && Date.now()-submitted.at<60_000 ? 4000 : false,
    staleTime: 3000,
  })
  useEffect(() => {
    if (!user || !submitted) return
    for (const item of data) if (shouldAnnounceExchange(item, submitted.id)) {
      const seenKey = `growth-notice:${user.id}:${item.award_event}`
      try { if (sessionStorage.getItem(seenKey)) continue; sessionStorage.setItem(seenKey,'1') } catch { continue }
      toast({ title: '高质量回复，获得 5 经验' })
    }
  }, [data, submitted, user, toast])
  return new Map(data.map(item => [item.id,item]))
}

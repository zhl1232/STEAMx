'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import { getShopItemById } from '@/lib/shop/items'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import Link from 'next/link'
import { Coins, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getActionLabel(actionType: string, resourceId: string | null): string {
  switch (actionType) {
    case 'daily_login':
      return '每日签到'
    case 'purchase': {
      const item = resourceId ? getShopItemById(resourceId) : null
      return item ? `兑换「${item.name}」` : '兑换商品'
    }
    case 'tip':
      return resourceId ? `打赏 ${resourceId}` : '打赏'
    default:
      return actionType || '其他'
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ProfileCoinsPage() {
  const { user, loading: authLoading } = useAuth()
  const { coins = 0 } = useGamification()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['coin_logs', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('coin_logs')
        .select('id, user_id, amount, action_type, resource_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  })

  if (!authLoading && !user) {
    router.replace('/login')
    return null
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-6 px-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profile" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">硬币流水</h1>
      </div>

      <div className="rounded-xl border bg-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">当前余额</span>
          <span className="flex items-center gap-1.5 text-lg font-bold">
            <Coins className="h-5 w-5 text-primary" />
            {coins} 硬币
          </span>
        </div>
        <Link href="/shop" className="mt-2 block text-sm text-primary hover:underline">
          去商店兑换 →
        </Link>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-medium text-muted-foreground">流水记录</h2>
        </div>
        <div className="divide-y">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-10 px-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">加载流水失败</p>
              <p className="text-xs text-muted-foreground mb-3 max-w-sm mx-auto">
                {error instanceof Error ? error.message : '请检查网络或稍后重试'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">暂无流水记录</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
                流水仅记录「每日签到」「兑换商品」「打赏」等操作。若你当前有余额但无记录，可能是历史余额；之后每次签到、兑换或打赏都会在这里显示。
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {getActionLabel(log.action_type, log.resource_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                </div>
                <span
                  className={log.amount >= 0 ? 'text-sm font-semibold text-green-600' : 'text-sm font-semibold text-red-600'}
                >
                  {log.amount >= 0 ? '+' : ''}{log.amount} 硬币
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

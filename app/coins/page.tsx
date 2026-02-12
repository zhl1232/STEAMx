'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { getShopItemById } from '@/lib/shop/items'
import { useQuery } from '@tanstack/react-query'

type CoinLogRow = Database['public']['Tables']['coin_logs']['Row']
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

export default function CoinsPage() {
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
  } = useQuery<CoinLogRow[]>({
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
    <div className="container max-w-4xl py-8 px-4 pb-24">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-full hover:bg-muted">
          <Link href="/profile">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的钱包</h1>
          <p className="text-sm text-muted-foreground">查看硬币余额与交易明细</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        {/* 左侧/顶部：余额卡片 */}
        <div className="h-fit">
          <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 p-6 shadow-sm sticky top-24">
            <div className="flex flex-col items-center text-center p-4">
              <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
                <Coins className="h-8 w-8" />
              </div>
              <span className="text-sm font-medium text-amber-800/80 dark:text-amber-200/80 mb-1">当前余额</span>
              <span className="text-4xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mb-6">
                {coins.toLocaleString()}
              </span>
              
              <Link href="/shop" className="w-full">
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md">
                  去商店兑换
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* 右侧/底部：流水列表 */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="font-semibold">交易记录</h2>
              <span className="text-xs text-muted-foreground bg-background border px-2 py-1 rounded-md">最近 {logs.length} 条</span>
            </div>
            
            <div className="divide-y">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">加载记录中...</p>
                </div>
              ) : isError ? (
                <div className="py-12 px-4 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive/80 mx-auto mb-3" />
                  <p className="font-medium mb-1">加载记录失败</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {error instanceof Error ? error.message : '请检查网络或稍后重试'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    刷新重试
                  </Button>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Coins className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">暂无交易记录</p>
                  <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                    您的硬币收支明细将显示在这里
                  </p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {getActionLabel(log.action_type, log.resource_id)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums px-2.5 py-1 rounded-full ${
                        log.amount >= 0 
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      {log.amount >= 0 ? '+' : ''}{log.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

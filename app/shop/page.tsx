'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import { SHOP_ITEMS, getShopItemById } from '@/lib/shop/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Coins, Loader2, Check, Sparkles, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'

export default function ShopPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { coins = 0 } = useGamification()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const equippedId = profile?.equipped_avatar_frame_id ?? null

  const { data: ownedItemIds = [] } = useQuery({
    queryKey: ['user_inventory', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id)
      return (data as { item_id: string }[] || []).map((r) => r.item_id)
    },
    enabled: !!user,
  })

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('purchase_item', { p_item_id: itemId } as never)
      if (error) throw error
      const res = data as { ok?: boolean; error?: string }
      if (!res?.ok) throw new Error(res?.error || 'purchase_failed')
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: ['user_inventory', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['coin_logs', user?.id] })
      refreshProfile()
      const item = getShopItemById(itemId)
      toast({ title: '兑换成功', description: item ? `已获得「${item.name}」` : undefined })
    },
    onError: (e: Error) => {
      const msg =
        e.message === 'insufficient_coins'
          ? '硬币不足'
          : e.message === 'invalid_item'
            ? '商品无效'
            : e.message === 'already_owned'
              ? '已拥有该商品，无需重复兑换'
              : e.message
      toast({ variant: 'destructive', title: '兑换失败', description: msg })
    },
  })

  const equipMutation = useMutation({
    mutationFn: async (itemId: string | null) => {
      const { data, error } = await supabase.rpc('equip_avatar_frame', { p_item_id: itemId ?? '' } as never)
      if (error) throw error
      const res = data as { ok?: boolean; error?: string }
      if (!res?.ok) throw new Error(res?.error || 'equip_failed')
    },
    onSuccess: () => {
      refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['user_inventory', user?.id] })
      toast({ title: '装备已更新' })
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: '装备失败', description: e.message })
    },
  })

  if (!authLoading && !user) {
    router.replace('/login')
    return null
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 md:h-9 md:w-9" asChild>
            <Link href="/profile" className="rounded-full" aria-label="返回">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
            <Sparkles className="h-7 w-7 text-primary shrink-0" />
            商店
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 shrink-0">
          <Coins className="h-5 w-5 text-amber-500" />
          <span className="font-semibold">{coins}</span>
          <span className="text-muted-foreground text-sm">硬币</span>
        </div>
      </div>

      <p className="text-muted-foreground mb-6">
        用每日登录获得的硬币兑换头像框，在个人中心与排行榜中展示。已拥有的商品在本页点击「装备」即可更换展示，点击「卸下」可取消装备。
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SHOP_ITEMS.map((item) => {
          const owned = ownedItemIds.includes(item.id)
          const equipped = equippedId === item.id
          const canBuy = !owned && coins >= item.price
          return (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  {equipped && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">已装备</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span>{item.price} 硬币</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {owned ? (
                    <>
                      {item.type === 'avatar_frame' && (
                        equipped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => equipMutation.mutate(null)}
                            disabled={equipMutation.isPending}
                          >
                            卸下
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => equipMutation.mutate(item.id)}
                            disabled={equipMutation.isPending}
                          >
                            {equipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                            装备
                          </Button>
                        )
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canBuy || purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate(item.id)}
                    >
                      {purchaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      兑换
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

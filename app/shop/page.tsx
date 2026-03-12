'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import { SHOP_ITEMS, getShopItemById, getNameColorClassName } from '@/lib/shop/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Coins, Loader2, ArrowLeft, Lock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'
import type { ShopItemType } from '@/lib/shop/items'
import type { Profile } from '@/lib/types/database'

export default function ShopPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { coins = 0, level = 1 } = useGamification()
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const equippedAvatarFrameId = (profile as Profile | null)?.equipped_avatar_frame_id ?? null
  const equippedNameColorId = (profile as Profile | null)?.equipped_name_color_id ?? null

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
    mutationFn: async ({ itemId, type }: { itemId: string | null; type: ShopItemType }) => {
      const rpcName = type === 'avatar_frame' ? 'equip_avatar_frame' : 'equip_name_color'
      const { data, error } = await (supabase.rpc as (name: string, args: { p_item_id: string }) => ReturnType<typeof supabase.rpc>)(rpcName, { p_item_id: itemId ?? '' })
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

  if (authLoading || !user) return null

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 md:h-9 md:w-9" asChild>
            <Link href="/profile" className="rounded-full" aria-label="返回">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold truncate">
            商店
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium text-muted-foreground">Lv.{level}</span>
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">{coins}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-8">
        用硬币兑换装扮特效，展示在个人中心与排行榜中。部分商品需达到对应等级才可兑换。
      </p>

      {/* 头像框区块 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">
          头像框
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP_ITEMS.filter(i => i.type === 'avatar_frame').map((item) => {
            const owned = ownedItemIds.includes(item.id)
            const equipped = equippedAvatarFrameId === item.id
            const canBuy = !owned && coins >= item.price
            const levelLocked = (item.minLevel ?? 0) > level

            return (
              <Card key={item.id} className={cn('overflow-visible flex flex-col relative group', levelLocked && 'grayscale-[10%] saturate-[90%]')}>
                <CardHeader className="pb-3 relative z-10 flex-none">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {item.minLevel ? (
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          levelLocked
                            ? 'text-muted-foreground bg-muted'
                            : 'text-primary bg-primary/10'
                        )}>
                          {levelLocked ? <Lock className="inline h-3 w-3 mr-0.5 -mt-0.5" /> : null}
                          Lv.{item.minLevel}
                        </span>
                      ) : null}
                      {equipped && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">使用中</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-3">
                  <div className="flex items-center justify-center flex-1 py-6 bg-gradient-to-b from-muted/50 to-muted/10 rounded-xl border border-border/50">
                    <AvatarWithFrame
                      avatarFrameId={item.id}
                      src={user?.user_metadata?.avatar_url}
                      fallback={getDisplayName({
                        profileName: null,
                        metadataFullName: user?.user_metadata?.full_name,
                        metadataName: user?.user_metadata?.username,
                        phone: user?.phone ?? null,
                        email: user?.email,
                        fallback: "?",
                      }).charAt(0)}
                      className="w-20 h-20"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">{item.price}</span>
                    </div>
                    <div className="w-24">
                      {owned ? (
                        equipped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => equipMutation.mutate({ itemId: null, type: item.type })}
                            disabled={equipMutation.isPending}
                          >
                            卸下
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => equipMutation.mutate({ itemId: item.id, type: item.type })}
                            disabled={equipMutation.isPending}
                          >
                            {equipMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            装备
                          </Button>
                        )
                      ) : levelLocked ? (
                        <Button size="sm" className="w-full" disabled>
                          <Lock className="h-3 w-3 mr-1" />
                          Lv.{item.minLevel}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!canBuy || purchaseMutation.isPending}
                          onClick={() => purchaseMutation.mutate(item.id)}
                        >
                          {purchaseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          兑换
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* 昵称颜色区块 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          昵称颜色
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP_ITEMS.filter(i => i.type === 'name_color').map((item) => {
            const owned = ownedItemIds.includes(item.id)
            const equipped = equippedNameColorId === item.id
            const canBuy = !owned && coins >= item.price
            const levelLocked = (item.minLevel ?? 0) > level

            return (
              <Card key={item.id} className={cn('overflow-visible flex flex-col relative group', levelLocked && 'grayscale-[10%] saturate-[90%]')}>
                <CardHeader className="pb-3 relative z-10 flex-none">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {item.minLevel ? (
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          levelLocked
                            ? 'text-muted-foreground bg-muted'
                            : 'text-primary bg-primary/10'
                        )}>
                          {levelLocked ? <Lock className="inline h-3 w-3 mr-0.5 -mt-0.5" /> : null}
                          Lv.{item.minLevel}
                        </span>
                      ) : null}
                      {equipped && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">使用中</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-3">
                  <div className="flex items-center justify-center flex-1 py-6 bg-gradient-to-b from-muted/50 to-muted/10 rounded-xl border border-border/50">
                    <span className={cn('text-2xl font-bold', getNameColorClassName(item.id))}>
                      {profile?.display_name || user?.user_metadata?.username || '测试昵称'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">{item.price}</span>
                    </div>
                    <div className="w-24">
                      {owned ? (
                        equipped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => equipMutation.mutate({ itemId: null, type: item.type })}
                            disabled={equipMutation.isPending}
                          >
                            卸下
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => equipMutation.mutate({ itemId: item.id, type: item.type })}
                            disabled={equipMutation.isPending}
                          >
                            {equipMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            装备
                          </Button>
                        )
                      ) : levelLocked ? (
                        <Button size="sm" className="w-full" disabled>
                          <Lock className="h-3 w-3 mr-1" />
                          Lv.{item.minLevel}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!canBuy || purchaseMutation.isPending}
                          onClick={() => purchaseMutation.mutate(item.id)}
                        >
                          {purchaseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          兑换
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import { SHOP_ITEMS, getShopItemById, getNameColorClassName } from '@/lib/shop/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { Coins, Loader2, Sparkles, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { cn } from '@/lib/utils'
import type { ShopItemType } from '@/lib/shop/items'
import type { Profile } from '@/lib/types/database'

export default function ShopPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { coins = 0 } = useGamification()
  const router = useRouter()
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
      const { data, error } = await supabase.rpc(rpcName, { p_item_id: itemId ?? '' } as never)
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
        用每日登录获得的硬币兑换特效，在个人中心与排行榜中展示。已拥有的商品在本页点击「装备」即可更换展示，点击「卸下」可取消装备。
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_ITEMS.map((item) => {
          const owned = ownedItemIds.includes(item.id)
          const equipped = (item.type === 'avatar_frame' && equippedAvatarFrameId === item.id) ||
                           (item.type === 'name_color' && equippedNameColorId === item.id)
          const canBuy = !owned && coins >= item.price
          
          return (
            <Card key={item.id} className="overflow-visible flex flex-col relative group">
              <CardHeader className="pb-4 relative z-10 flex-none">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wider mt-1">
                      {item.type === 'avatar_frame' ? '头像框' : '名字颜色'}
                    </CardDescription>
                  </div>
                  {equipped && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded shadow-sm">正在装备</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 space-y-4">
                <div className="flex items-center justify-center flex-1 py-8 mb-2 bg-gradient-to-b from-muted/50 to-muted/10 rounded-xl border border-border/50">
                  {/* 预览区域 */}
                  {item.type === 'avatar_frame' ? (
                    <AvatarWithFrame
                      avatarFrameId={item.id}
                      src={user?.user_metadata?.avatar_url}
                      fallback={user?.user_metadata?.username?.charAt(0) || user?.email?.charAt(0) || '?'}
                      className="w-20 h-20"
                    />
                  ) : (
                    <span className={cn('text-2xl', getNameColorClassName(item.id))}>
                      {user?.user_metadata?.username || '测试昵称'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground font-medium pt-2">
                  <Coins className="h-5 w-5 text-amber-500" />
                  <span>{item.price} 硬币</span>
                </div>

                <div className="flex flex-wrap gap-2 w-full pt-1">
                  {owned ? (
                    equipped ? (
                      <Button
                        variant="outline"
                        className="w-full flex-1"
                        onClick={() => equipMutation.mutate({ itemId: null, type: item.type })}
                        disabled={equipMutation.isPending}
                      >
                        卸下
                      </Button>
                    ) : (
                      <Button
                        className="w-full flex-1"
                        onClick={() => equipMutation.mutate({ itemId: item.id, type: item.type })}
                        disabled={equipMutation.isPending}
                      >
                        {equipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        装备
                      </Button>
                    )
                  ) : (
                    <Button
                      className="w-full flex-1"
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

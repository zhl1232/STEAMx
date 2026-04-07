'use client'

import { useAuth } from '@/context/auth-context'
import { useGamification } from '@/context/gamification-context'
import { createClient } from '@/lib/supabase/client'
import { SHOP_ITEMS, getShopItemById, getNameColorClassName } from '@/lib/shop/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Loader2, ArrowLeft, Lock, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { CoinIcon } from '@/components/icons/coin-icon'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import type { ShopItemType } from '@/lib/shop/items'
import type { Profile } from '@/lib/types/database'

type ShopRpcResult = {
  ok?: boolean
  error?: string
  item_id?: string
  price?: number
  min_level?: number
  level?: number
}

type ShopMutationError = Error & {
  code?: string
  minLevel?: number
  currentLevel?: number
}

function createShopMutationError(result: ShopRpcResult, fallbackCode: string): ShopMutationError {
  const error = new Error(result.error || fallbackCode) as ShopMutationError
  error.code = result.error || fallbackCode
  error.minLevel = result.min_level
  error.currentLevel = result.level
  return error
}

export function getShopMutationErrorMessage(error: unknown): string {
  const shopError = error as ShopMutationError | null
  const code = shopError?.code || shopError?.message

  switch (code) {
    case 'insufficient_coins':
      return '硬币不足'
    case 'invalid_item':
      return '商品无效'
    case 'already_owned':
      return '已拥有该商品，无需重复兑换'
    case 'unauthorized':
      return '登录状态已失效，请重新登录后再试'
    case 'profile_not_found':
      return '未找到当前账号资料，请稍后重试'
    case 'min_level_required':
      return typeof shopError?.minLevel === 'number'
        ? `等级不足，需达到 Lv.${shopError.minLevel}`
        : '当前等级不足，暂时无法兑换'
    case 'not_owned':
      return '未拥有该商品，无法装备'
    case 'not_name_color':
      return '该商品不是昵称颜色，无法装备'
    case 'equip_failed':
      return '装备失败，请稍后重试'
    case 'purchase_failed':
      return '兑换失败，请稍后重试'
    default:
      return error instanceof Error && error.message ? error.message : '请稍后重试'
  }
}

export default function ShopPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { coins = 0, level = 1 } = useGamification()
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const equippedAvatarFrameId = (profile as Profile | null)?.equipped_avatar_frame_id ?? null
  const equippedNameColorId = (profile as Profile | null)?.equipped_name_color_id ?? null

  const {
    data: ownedItemIds = [],
    isLoading: inventoryLoading,
    isError: inventoryError,
    error: inventoryErrorDetail,
    refetch: refetchInventory,
  } = useQuery<string[]>({
    queryKey: ['user_inventory', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('user_inventory')
        .select('item_id')
      .eq('user_id', user.id)
      if (error) throw error
      return (data as { item_id: string }[] || []).map((r) => r.item_id)
    },
    enabled: !!user,
  })

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('purchase_item', { p_item_id: itemId } as never)
      if (error) throw error
      const res = data as ShopRpcResult
      if (!res?.ok) throw createShopMutationError(res, 'purchase_failed')
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: ['user_inventory', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['coin_logs', user?.id] })
      refreshProfile()
      const item = getShopItemById(itemId)
      toast({ title: '兑换成功', description: item ? `已获得「${item.name}」` : undefined })
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '兑换失败',
        description: getShopMutationErrorMessage(error),
      })
    },
  })

  const equipMutation = useMutation({
    mutationFn: async ({ itemId, type }: { itemId: string | null; type: ShopItemType }) => {
      const rpcName = type === 'avatar_frame' ? 'equip_avatar_frame' : 'equip_name_color'
      const { data, error } = await (supabase.rpc as (name: string, args: { p_item_id: string }) => ReturnType<typeof supabase.rpc>)(rpcName, { p_item_id: itemId ?? '' })
      if (error) throw error
      const res = data as ShopRpcResult
      if (!res?.ok) throw createShopMutationError(res, 'equip_failed')
    },
    onSuccess: () => {
      refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['user_inventory', user?.id] })
      toast({ title: '装备已更新' })
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '装备失败',
        description: getShopMutationErrorMessage(error),
      })
    },
  })

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (inventoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载商店中...</p>
        </div>
      </div>
    )
  }

  if (inventoryError) {
    return (
      <div className="container max-w-2xl py-12 px-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="space-y-1">
              <p className="font-semibold">加载商店失败</p>
              <p className="text-sm text-muted-foreground">
                {inventoryErrorDetail instanceof Error ? inventoryErrorDetail.message : '请检查网络后重试'}
              </p>
            </div>
            <Button variant="outline" onClick={() => refetchInventory()}>
              刷新重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <MobilePageHeader
        title="商店"
        fallbackHref="/profile"
        className="-mx-4 -mt-8 mb-6 md:hidden"
        rightSlot={(
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">Lv.{level}</span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-1 font-medium text-foreground">
              <CoinIcon className="h-3.5 w-3.5 text-amber-500" />
              {coins}
            </span>
          </div>
        )}
      />

      <div className="hidden items-center justify-between mb-6 md:flex">
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
            <CoinIcon className="h-4 w-4 text-amber-500" />
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
                      src={profile?.avatar_url || getDefaultAvatarPath(user.id)}
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
                      <CoinIcon className="h-4 w-4 text-amber-500" />
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
                      <CoinIcon className="h-4 w-4 text-amber-500" />
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

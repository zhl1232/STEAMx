"use client"

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type ShopPrice = { id: string; basePrice: number; price: number; minLevel: number; owned: boolean }
export type ShopPrices = { membershipTier: 'free' | 'pro' | 'founder'; coins: number; level: number; items: ShopPrice[] }

/** The same database pricing function is used by purchase_item under a profile lock. */
export function useShopPrices(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['shop_prices', userId],
    queryFn: async (): Promise<ShopPrices> => {
      const { data, error } = await supabase.rpc('get_shop_prices', {})
      if (error) throw error
      const quote = data as unknown as ShopPrices
      if (!quote || !Array.isArray(quote.items)) throw new Error('价格暂时无法加载，请稍后重试')
      return quote
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

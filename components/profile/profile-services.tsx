'use client'

import Link from 'next/link'
import { useStoreEntryVisible } from '@/lib/context/store-availability-context'
import { Headphones, Package, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

export function ProfileServices() {
  const storeEntryVisible = useStoreEntryVisible()
  return (
    <Surface role="region" className="p-4 sm:p-5" aria-label="购物与服务">
      <h2 className="text-base font-semibold">购物与服务</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {storeEntryVisible ? (
          <Button asChild variant="outline" className="min-h-11 gap-2">
            <Link href="/store"><ShoppingBag className="h-4 w-4" />材料商城</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="min-h-11 gap-2">
          <Link href="/store/orders"><Package className="h-4 w-4" />我的订单</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 gap-2">
          <Link href="/store/coupons">我的优惠券</Link>
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <Button asChild variant="ghost" className="min-h-11 gap-2 px-2">
          <Link href="/support"><Headphones className="h-4 w-4" />平台帮助</Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11 gap-2 px-2">
          <Link href="/store/support"><Headphones className="h-4 w-4" />商城客服</Link>
        </Button>
      </div>
    </Surface>
  )
}

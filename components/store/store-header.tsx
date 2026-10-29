'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronLeft, Ellipsis } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function StoreHeader({ categories, back, title }: { categories?: ReactNode; back?: { href: string; label: string }; title?: string }) {
  const destination = back ?? { href: '/', label: '返回主站' }
  return <header className="mb-5 min-w-0 sm:mb-7">
    <div className="flex min-h-12 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href={destination.href} aria-label={destination.label} className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft aria-hidden className="h-5 w-5" /></Link>
        <span className="truncate text-base font-semibold">{title ?? (categories ? '材料商城' : '商品详情')}</span>
      </div>
      <nav aria-label="商城服务" className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/store/orders" className="inline-flex min-h-11 items-center px-2 hover:text-foreground">订单</Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" aria-label="更多商城服务" className="inline-flex h-11 w-11 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Ellipsis aria-hidden className="h-5 w-5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href="/store/coupons" className="min-h-11">我的优惠券</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/store/support" className="min-h-11">商城客服</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
    {categories ? <div className="mt-2">{categories}</div> : null}
  </header>
}

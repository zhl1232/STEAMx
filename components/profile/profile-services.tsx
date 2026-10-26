'use client'

import Link from 'next/link'
import { Headphones, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

export function ProfileServices() {
  return <Surface role="region" className="p-4 sm:p-5" aria-label="购物与服务">
    <h2 className="text-panel-title">购物与服务</h2>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild variant="outline" shape="pill" className="min-h-11 flex-1 gap-2">
        <Link href="/store/orders"><Package className="h-4 w-4" />我的订单</Link>
      </Button>
      <Button asChild variant="outline" shape="pill" className="min-h-11 flex-1 gap-2">
        <Link href="/support"><Headphones className="h-4 w-4" />平台帮助</Link>
      </Button>
      <Button asChild variant="outline" shape="pill" className="min-h-11 flex-1 gap-2">
        <Link href="/store/support"><Headphones className="h-4 w-4" />商城客服</Link>
      </Button>
    </div>
  </Surface>
}

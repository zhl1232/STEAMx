import Link from 'next/link'
import { Blocks, FlaskConical, Leaf, PencilRuler } from 'lucide-react'

import { PLATFORM_START_ACTIONS } from '@/lib/product/onboarding'
import { PLATFORM_SUPPORT_HREF } from '@/lib/product/support'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata = buildPageMetadata({
  title: '选一个开始',
  description: '和孩子选一件想做的事：搭积木、做小实验、学编程，或去自然里观察。',
  path: '/start',
})

const ICONS = { blocks: Blocks, science: FlaskConical, scratch: PencilRuler, nature: Leaf }

export default function StartPage() {
  return (
    <main className="app-shell-narrow pb-28 pt-5 md:py-12">
      <header>
        <p className="text-sm text-muted-foreground">欢迎来到创探空间</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">今天想和孩子做点什么？</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">选一个感兴趣的方向，一起动手试试。</p>
      </header>
      <nav aria-label="选择开始方向" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        {PLATFORM_START_ACTIONS.map((item) => {
          const Icon = ICONS[item.id]
          return (
            <Link key={item.id} href={item.href} prefetch={false}
              className="surface-card group min-w-0 p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5">
              <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
              <span className="block text-base font-semibold leading-6 text-foreground">{item.label}</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.description}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 text-sm">
        <Link href="/explore" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">先随便看看</Link>
        <Link href={PLATFORM_SUPPORT_HREF} className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">联系客服</Link>
      </div>
    </main>
  )
}

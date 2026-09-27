import Link from 'next/link'
import { ArrowRight, Blocks, FlaskConical, Gamepad2, Leaf, PencilRuler, Sprout } from 'lucide-react'

import { PLATFORM_GUIDE_LINKS } from '@/lib/product/onboarding'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata = buildPageMetadata({
  title: '探索指南',
  description: '从动手实践、编程、科学实验、自然观察、项目学习和游乐场中选择你的起点。',
  path: '/start',
})

const ICONS = [Blocks, PencilRuler, FlaskConical, Leaf, Sprout, Gamepad2]

export default function StartPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary">创探空间</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">从你感兴趣的方向开始</h1>
        <p className="text-base leading-8 text-muted-foreground sm:text-lg">创探空间陪孩子从好奇出发，在动手、观察、提问和反复尝试中找到自己的学习路径。先选一个想试试的方向，边做边发现下一步。</p>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {PLATFORM_GUIDE_LINKS.map((item, index) => {
          const Icon = ICONS[index]
          return (
            <Link key={item.href} href={item.href} className="group flex min-h-32 items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/40">
              <span className="flex items-start gap-4">
                <span className="rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="space-y-1"><span className="block text-base font-semibold">{item.label}</span><span className="block text-sm leading-6 text-muted-foreground">{item.description}</span></span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          )
        })}
      </div>
      <p className="mt-8 text-sm leading-7 text-muted-foreground">家长或老师想了解平台、添加客服申请入群？请前往<Link href="/about#contact" className="ml-1 underline underline-offset-4">帮助与联系方式</Link>，添加客服时备注「入群」。</p>
    </main>
  )
}

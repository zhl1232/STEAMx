import Link from 'next/link'
import { ArrowRight, Blocks, FlaskConical, Leaf, PencilRuler } from 'lucide-react'

import { PLATFORM_GUIDE_LINKS } from '@/lib/product/onboarding'
import { LEARNING_QUICK_START } from '@/lib/product/learning-quick-start'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata = buildPageMetadata({
  title: '探索指南',
  description: '从动手实践、编程、科学实验、自然观察、项目学习和游乐场中选择你的起点。',
  path: '/start',
})

const ICONS = [Blocks, PencilRuler, FlaskConical, Leaf]

export default function StartPage() {
  const firstTry = LEARNING_QUICK_START.nature
  return (
    <main className="app-shell-wide pb-28 pt-8 md:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">从你感兴趣的方向开始</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">选一件想做的事，准备材料，和孩子一起试。</p>
      </header>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-8">
        <section aria-labelledby="start-first-try" className="rounded-xl border border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green)/0.06)] p-5 md:p-6">
          <p className="text-xs font-semibold text-[hsl(var(--brand-green))]">还没想好？先试这个</p>
          <h2 id="start-first-try" className="mt-2 text-xl font-bold text-foreground">观察身边的一棵树</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/85">{firstTry.summary}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground"><strong className="font-semibold text-foreground">准备：</strong>{firstTry.materials}</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">孩子由成人陪同，保持距离，不触碰、不采摘。</p>
          <Link href="/learn/nature#first-try" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            开始这次观察<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
        <section aria-labelledby="start-directions">
          <h2 id="start-directions" className="mb-3 text-base font-semibold text-foreground">也可以选一个喜欢的方向</h2>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORM_GUIDE_LINKS.slice(0, 4).map((item, index) => {
              const Icon = ICONS[index]
              return (
                <Link key={item.href} href={item.href} className="group min-w-0 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5">
                  <Icon className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="block text-sm font-semibold text-foreground sm:text-base">{item.label}</span>
                  <span className="mt-1 block text-xs leading-6 text-muted-foreground sm:text-sm">{item.description}</span>
                </Link>
              )
            })}
          </div>
          <nav aria-label="其他探索方式" className="mt-3 flex flex-wrap gap-x-5 text-sm">
            {PLATFORM_GUIDE_LINKS.slice(4).map((item) => (
              <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline">
                {item.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </section>
      </div>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">需要帮助或申请入群？<Link href="/about#contact" className="ml-1 inline-flex min-h-11 items-center underline underline-offset-4">帮助与联系方式</Link></p>
    </main>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpenCheck, FolderOpen, Leaf, Sparkles } from 'lucide-react'

import { AuthFlow } from '@/components/auth/auth-flow'
import { SteamLogo } from '@/components/layout/logo'

export default function LoginPage() {
  const router = useRouter()

  return (
    <main className="app-canvas min-h-screen px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <SteamLogo className="h-9 w-9" />
          <span className="font-heading text-xl font-semibold tracking-tight text-foreground">STEAM 探索</span>
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          先去探索
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-5xl gap-5 lg:mt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,440px)] lg:items-center">
        <section className="relative order-2 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_24px_70px_-52px_hsl(var(--surface-shadow)/0.42)] sm:p-7 lg:order-1 lg:min-h-[560px]">
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="max-w-xl">
              <p className="section-kicker">探索 · 创造 · 成长</p>
              <h1 className="mt-5 max-w-md font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                回到你的探索档案
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                作品、自然观察、徽章和本周计划会接在一起，登录后继续刚才打开的页面。
              </p>
            </div>

            <div className="max-w-md space-y-4">
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <BookOpenCheck className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">本周下一步</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">继续计划、完成新手引导，少一点翻找。</p>
                </div>
              </div>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]">
                  <Leaf className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">观察与作品</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">把实验、照片和完成记录整理成可回看的档案。</p>
                </div>
              </div>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[hsl(var(--brand-amber)/0.14)] text-[hsl(var(--brand-amber))]">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">徽章与能力雷达</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">看到自己在哪些 STEAM 能力上正在发光。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 overflow-hidden">
            <Image
              src="/assets/community-hero-kids-robot.png"
              alt=""
              fill
              priority
              className="object-cover object-bottom opacity-[0.12]"
              sizes="(min-width: 1024px) 52vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/95 to-card/20" />
          </div>
          <div className="pointer-events-none absolute right-8 top-8 hidden h-24 w-24 rotate-6 rounded-xl border border-primary/10 bg-background/56 shadow-[0_18px_38px_-30px_hsl(var(--surface-shadow)/0.44)] lg:grid lg:place-items-center">
            <FolderOpen className="h-9 w-9 text-primary/70" />
          </div>
        </section>

        <div className="order-1 lg:order-2">
          <AuthFlow
            presentation="page"
            onBack={() => router.back()}
          />
        </div>
      </div>
    </main>
  )
}

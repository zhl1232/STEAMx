'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Compass } from 'lucide-react'

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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-background p-4 shadow-sm">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Compass className="h-4 w-4" />
                </span>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">登录成功后会继续跳回原本要访问的页面。</p>
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

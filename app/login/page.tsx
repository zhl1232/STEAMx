'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Beaker, BookOpenCheck, Compass, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

import { AuthFlow } from '@/components/auth/auth-flow'
import { SteamLogo } from '@/components/layout/logo'

export default function LoginPage() {
  const router = useRouter()

  return (
    <div className="app-canvas min-h-screen overflow-hidden px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <SteamLogo className="h-9 w-9" />
          <span className="font-heading text-xl font-semibold tracking-tight text-foreground">STEAM 探索</span>
        </Link>
        <Link
          href="/explore"
          className="hidden rounded-full border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          先去探索
        </Link>
      </div>

      <div className="mx-auto mt-5 grid w-full max-w-6xl gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.92fr)_280px] lg:items-start xl:gap-6">
        <section className="surface-panel relative min-h-[310px] overflow-hidden p-0 sm:min-h-[360px] lg:min-h-[640px]">
          <Image
            src="/assets/community-hero-kids-robot.png"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 38vw, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/0 to-background/86" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <p className="section-kicker">探索 · 创造 · 成长</p>
            <h1 className="mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              在 STEAM 项目里记录每一次动手与发现
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              登录后可保存项目进度、提交挑战作品、收藏灵感并同步个人内容库。
            </p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                { label: '项目', value: '28.7k', icon: Beaker },
                { label: '挑战', value: '12.4k', icon: Sparkles },
                { label: '观察', value: '3.4k', icon: Compass },
                { label: '伙伴', value: '156k', icon: UsersRound },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-background/82 px-2.5 py-3 text-center backdrop-blur">
                  <item.icon className="mx-auto h-4 w-4 text-primary" />
                  <p className="mt-1 text-sm font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AuthFlow
          presentation="page"
          title="欢迎回到 STEAM 探索"
          description="用手机号或邮箱继续你的项目、观察和社区挑战。"
          onBack={() => router.back()}
        />

        <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[
            {
              icon: BookOpenCheck,
              title: '继续上次进度',
              desc: '同步收藏、完成记录和挑战提交状态。',
              action: '查看内容库',
              href: '/profile/library',
            },
            {
              icon: ShieldCheck,
              title: '账号安全保护',
              desc: '登录后可管理密码、隐私和通知偏好。',
              action: '安全设置',
              href: '/settings/security',
            },
          ].map((card) => (
            <Link key={card.title} href={card.href} className="surface-card group block p-5 transition hover:-translate-y-0.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <card.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold tracking-tight">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.desc}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-primary">{card.action}</span>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  )
}

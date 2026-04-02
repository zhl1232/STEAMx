"use client";

import Link from "next/link";
import { ChevronRight, FileText, MessageSquareHeart, ShieldAlert } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";

const FAQ_ITEMS = [
  {
    q: "如何修改密码？",
    a: "已登录时请进入「设置」→「账号与安全」直接修改密码；如果忘记密码，请在登录页使用“忘记密码”发送重置邮件。",
  },
  {
    q: "如何联系客服？",
    a: "您可通过设置中的「问题反馈」发送邮件，或在平台内使用反馈入口与我们联系。",
  },
  {
    q: "项目审核需要多久？",
    a: "一般在 1 到 3 个工作日内完成审核，审核结果会通过站内通知或邮件告知。",
  },
];

export default function AboutSettingsPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

  const linkItems = [
    ...(supportEmail
      ? [
          {
            icon: MessageSquareHeart,
            label: "问题反馈",
            href: `mailto:${supportEmail}?subject=问题反馈`,
            external: true,
            description: "通过邮件反馈问题或建议。",
          },
        ]
      : []),
    {
      icon: FileText,
      label: "用户协议",
      href: "/legal/terms",
      external: false,
      description: "查看平台的使用规则与服务条款。",
    },
    {
      icon: ShieldAlert,
      label: "隐私政策",
      href: "/legal/privacy",
      external: false,
      description: "了解个人信息的收集、使用与保护方式。",
    },
  ];

  return (
    <SettingsSubpageShell
      title="关于与帮助"
      description="集中放置帮助入口、反馈方式和平台规则，让支持信息与设置中心保持连续。"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">平台信息</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">STEAM 探索</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              当前版本为 v1.0.0。这里负责承接帮助、政策和反馈，不再单独使用旧式内容页容器。
            </p>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">支持建议</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">优先查看常见问题</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              密码、审核与联系平台等高频问题已经整理在右侧，可先快速确认。
            </p>
          </section>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">帮助入口</h2>
          </div>
          <div className="space-y-3">
            {!supportEmail ? (
              <div className="surface-subtle flex items-center justify-between gap-4 px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquareHeart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">问题反馈</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">暂未配置反馈邮箱。</p>
                  </div>
                </div>
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs">未启用</span>
              </div>
            ) : null}

            {linkItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="surface-subtle flex items-center justify-between gap-4 px-4 py-4 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">常见问题</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.q} className="surface-subtle group px-4 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 border-t border-border/70 pt-3 text-sm leading-7 text-muted-foreground">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </SettingsSubpageShell>
  );
}

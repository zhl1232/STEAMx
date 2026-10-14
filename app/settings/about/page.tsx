"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Copy, FileText, Loader2, Mail, MessageSquareHeart, ShieldAlert } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  BRAND_CORE_STATEMENT,
  BRAND_FULL_NAME,
} from "@/lib/brand";
import { BRAND_FAQ_ITEMS } from "@/lib/seo/brand-faq";
import { SITE_DESCRIPTION } from "@/lib/seo/site";

const LEARNING_PRINCIPLES = [
  {
    title: "兴趣驱动",
    description: "从孩子真正好奇的问题出发，让选择和提问成为学习的起点。喜欢一只昆虫、好奇一座桥为什么稳固，都可以开启一次探索。",
  },
  {
    title: "动手探究",
    description: "先观察、再猜想、动手验证。看见尝试带来的变化，也把暂时没成功的结果变成下一次改进的线索。",
  },
  {
    title: "自主挑战",
    description: "从跟着步骤做开始，逐渐提出自己的目标，拆解任务、选择材料与方法，尝试完成自己的方案。",
  },
  {
    title: "协作与迭代",
    description: "把科学、技术、工程、艺术与数学结合起来，分享想法、听取反馈、调整方案，在合作与改进中积累解决问题的经验。",
  },
] as const;

const FAQ_ITEMS = [
  ...BRAND_FAQ_ITEMS.map((item) => ({ q: item.question, a: item.answer })),
  {
    q: "如何修改密码？",
    a: "已登录时请进入「设置」→「账号与安全」直接修改密码；如果忘记密码，请在登录页使用“忘记密码”发送重置邮件。",
  },
  {
    q: "如何联系客服？",
    a: "问题反馈会直接发给平台客服，回复会回到站内消息。",
  },
  {
    q: "项目审核需要多久？",
    a: "一般在 1 到 3 个工作日内完成审核，审核结果会通过站内通知或邮件告知。",
  },
];

export default function AboutSettingsPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  const supportWechat = process.env.NEXT_PUBLIC_SUPPORT_WECHAT?.trim() ?? "";
  const { user } = useAuth();
  const { promptLogin } = useLoginPrompt();
  const { toast } = useToast();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const openFeedback = () => {
    if (!user) {
      promptLogin(() => setFeedbackOpen(true), {
        title: "登录后提交反馈",
        description: "登录后即可把问题发给平台客服，回复会回到站内消息。",
      });
      return;
    }
    setFeedbackOpen(true);
  };

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = feedbackText.trim();
    if (!content || feedbackSubmitting) return;
    if (!user) {
      openFeedback();
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await fetch("/api/settings/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; recipientName?: string };
      if (!response.ok) throw new Error(payload.error || "反馈发送失败，请稍后重试");

      toast({
        title: "反馈已发送",
        description: `已发送给${payload.recipientName || "平台客服"}，回复会回到站内消息。`,
      });
      setFeedbackText("");
      setFeedbackOpen(false);
    } catch (error) {
      toast({
        title: "反馈发送失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const copyWechat = async () => {
    if (!supportWechat) return;

    try {
      await navigator.clipboard.writeText(supportWechat);
      toast({ title: "微信号已复制" });
    } catch {
      toast({ title: "复制失败", description: "请手动记下微信号。", variant: "destructive" });
    }
  };

  const linkItems = [
    ...(supportEmail
      ? [
          {
            icon: Mail,
            label: "邮件反馈（备用）",
            href: `mailto:${supportEmail}?subject=问题反馈`,
            external: true,
            description: "无法使用站内反馈时，可通过邮件联系平台。",
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
      fallbackHref={user ? "/settings" : "/"}
      kicker="支持与规则"
      description="联系客服、提交反馈，或了解平台。"
    >
      <div className="space-y-6">
        <section id="support" aria-labelledby="support-heading" className="scroll-mt-24 space-y-4">
          {/* 保留旧消息和站外链接的锚点；它现在也落到客服而非公众号。 */}
          <span id="contact" aria-hidden="true" className="block scroll-mt-24" />
          <div className="space-y-2 px-1">
            <h2 id="support-heading" className="settings-section-heading">联系客服</h2>
            <p className="text-sm leading-6 text-muted-foreground">遇到问题可以直接反馈，回复会回到站内消息。</p>
          </div>
          <div className="settings-list">
            <button id="feedback" type="button" className="settings-row min-h-11 scroll-mt-24" onClick={openFeedback}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="settings-icon">
                  <MessageSquareHeart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">问题反馈</div>
                  <p className="settings-description">直接发给平台客服，回复会回到站内消息。</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
          <div id="wechat-support" className="scroll-mt-24 space-y-3 px-1">
            <h3 className="text-sm font-semibold">微信客服</h3>
            {supportWechat ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 break-all text-sm leading-6">微信号：<span className="select-all">{supportWechat}</span></p>
                <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => void copyWechat()}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />复制微信号
                </Button>
              </div>
            ) : null}
            <details open={!supportWechat}>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">查看微信客服二维码</summary>
              <a href="/assets/contact-wechat-20261014.jpg" target="_blank" rel="noopener noreferrer" aria-label="查看微信客服二维码原图（新窗口）" className="mt-2 flex h-60 justify-center overflow-hidden rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Image src="/assets/contact-wechat-20261014.jpg" alt="添加微信客服「北京创探科技」的二维码" width={888} height={1131} unoptimized className="h-full w-auto object-contain" />
              </a>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">点击图片查看、保存原图，再打开微信扫一扫，从相册选择这张二维码。</p>
            </details>
            <details id="join-group" className="scroll-mt-24 border-t border-border/60 pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">申请加入交流社群</summary>
              <p className="text-sm leading-6 text-muted-foreground">家长或老师需要入群时，添加上方微信客服并备注「入群」。普通使用咨询无需备注，也不需要先入群。</p>
            </details>
          </div>
        </section>

        <section id="about" className="scroll-mt-24 space-y-2 px-1">
          <h2 className="settings-section-heading">关于 {BRAND_FULL_NAME}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{SITE_DESCRIPTION}</p>
          <p className="text-sm leading-7 text-muted-foreground">
            可从首页进入积木课程、科学实践、自然观察与项目探索。
          </p>
          <p className="text-sm leading-7">
            <Link href="/" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              返回 {BRAND_FULL_NAME} 官网首页
            </Link>
          </p>
        </section>

        <section id="philosophy" aria-labelledby="philosophy-heading" className="scroll-mt-24 space-y-5 border-t border-border/60 px-1 pt-6">
          <div className="space-y-3">
            <h2 id="philosophy-heading" className="settings-section-heading">我们的教育理念</h2>
            <p className="text-base leading-8 text-foreground">{BRAND_CORE_STATEMENT}</p>
          </div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {LEARNING_PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="text-sm font-semibold text-foreground">{principle.title}</dt>
                <dd className="mt-1.5 text-sm leading-7 text-muted-foreground">{principle.description}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm leading-7 text-muted-foreground">
            家长和老师可以提供材料、安全支持与追问的空间，陪孩子观察和复盘，也给他们独立尝试的时间。
          </p>
        </section>

        <section id="official-account" aria-labelledby="official-account-heading" className="scroll-mt-24 space-y-3 border-t border-border/60 px-1 pt-6">
          <h2 id="official-account-heading" className="settings-section-heading">关注公众号</h2>
          <p className="text-sm leading-6 text-muted-foreground">获取项目灵感、课程更新与教育分享。</p>
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">查看公众号二维码</summary>
            <a href="/assets/contact-official-account.png" target="_blank" rel="noopener noreferrer" aria-label="查看公众号二维码原图（新窗口）" className="mt-2 flex items-center rounded-md bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Image src="/assets/contact-official-account.png" alt="微信扫一扫，或搜索公众号「创探空间」" width={1710} height={624} unoptimized className="h-auto w-full" />
            </a>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">微信搜一搜「创探空间」，或保存图片后在微信扫一扫中从相册选择。</p>
          </details>
        </section>

        <section aria-labelledby="help-heading" className="space-y-3">
          <div className="px-1">
            <h2 id="help-heading" className="settings-section-heading">平台规则与备用联系</h2>
          </div>
          <div className="settings-list">
            {linkItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="settings-row"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="settings-icon">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <p className="settings-description">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-3">
          <div className="px-1">
            <h2 className="settings-section-heading">常见问题</h2>
          </div>
          <div className="settings-list">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.q} className="group px-3 py-3 text-left transition-colors hover:bg-muted/45 sm:px-4 sm:py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>

      <Dialog
        open={feedbackOpen}
        onOpenChange={(open) => {
          setFeedbackOpen(open);
          if (!open && !feedbackSubmitting) setFeedbackText("");
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md gap-5 rounded-md p-5 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle>提交问题反馈</DialogTitle>
            <DialogDescription className="leading-6">
              反馈会发送给平台客服，管理员会在站内消息中回复你。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFeedbackSubmit}>
            <div className="space-y-2">
              <label htmlFor="settings-feedback" className="text-sm font-medium">
                反馈内容
              </label>
              <Textarea
                id="settings-feedback"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value.slice(0, 1800))}
                placeholder="请描述遇到的问题或想法"
                rows={6}
                maxLength={1800}
                autoFocus
                disabled={feedbackSubmitting}
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>每小时最多提交 5 次</span>
                <span>{feedbackText.length}/1800</span>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFeedbackOpen(false)}
                disabled={feedbackSubmitting}
              >
                取消
              </Button>
              <Button type="submit" tone="brand" shape="soft" disabled={feedbackSubmitting || !feedbackText.trim()}>
                {feedbackSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                发送反馈
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSubpageShell>
  );
}

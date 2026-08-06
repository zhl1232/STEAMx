"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Copy, FileText, Loader2, Mail, MessageCircle, MessageSquareHeart, ShieldAlert } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { Button } from "@/components/ui/button";
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

const FAQ_ITEMS = [
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
  const { toast } = useToast();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = feedbackText.trim();
    if (!content || feedbackSubmitting) return;

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
      kicker="支持与规则"
      description="查看帮助、提交反馈和平台规则。"
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="settings-section-heading">帮助入口</h2>
          </div>
          <div className="settings-list">
            <button type="button" className="settings-row" onClick={() => setFeedbackOpen(true)}>
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

            {supportWechat ? (
              <div className="settings-row cursor-default">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="settings-icon">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">微信反馈（备用）</div>
                    <p className="settings-description">站内提交优先，也可添加微信：{supportWechat}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="复制微信号"
                  title="复制微信号"
                  onClick={() => void copyWechat()}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

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

        <section className="space-y-3">
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

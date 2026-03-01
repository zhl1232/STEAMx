"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquareHeart, FileText, ShieldAlert, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const FEEDBACK_EMAIL = "feedback@example.com";
const FAQ_ITEMS = [
  {
    q: "如何修改密码？",
    a: "请进入「设置」→「账号与安全」→「修改密码」，我们会向您的绑定邮箱发送重置链接，点击邮件中的链接即可设置新密码。",
  },
  {
    q: "如何联系客服？",
    a: "您可通过设置中的「问题反馈」发送邮件，或在本平台内使用反馈入口与我们联系。",
  },
  {
    q: "项目审核需要多久？",
    a: "一般在 1～3 个工作日内完成审核，审核结果会通过站内通知或邮件告知。",
  },
];

export default function AboutSettingsPage() {
  const router = useRouter();

  const linkItems = [
    {
      icon: MessageSquareHeart,
      label: "问题反馈",
      href: `mailto:${FEEDBACK_EMAIL}?subject=问题反馈`,
      external: true,
    },
    {
      icon: FileText,
      label: "用户协议",
      href: "/legal/terms",
      external: false,
    },
    {
      icon: ShieldAlert,
      label: "隐私政策",
      href: "/legal/privacy",
      external: false,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">关于与帮助</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {linkItems.map((item, index) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
                {index < linkItems.length - 1 && <Separator className="ml-14" />}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              常见问题
            </h2>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {FAQ_ITEMS.map((faq, idx) => (
                <details
                  key={faq.q}
                  className={`group border-b last:border-b-0 ${idx === 0 ? "rounded-t-2xl" : ""} ${idx === FAQ_ITEMS.length - 1 ? "rounded-b-2xl" : ""}`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium text-sm hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
                    <span>{faq.q}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t px-4 pb-4 pt-1 text-sm text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="text-center w-full mt-4 flex flex-col items-center justify-center opacity-70">
            <h3 className="font-semibold tracking-wide">Steam Explore</h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">v1.0.0</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

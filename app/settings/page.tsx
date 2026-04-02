"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, ChevronRight, Shield, Bell, Eye, HelpCircle, Palette, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [supabase] = useState(() => createClient());

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "退出登录失败",
        description: error instanceof Error ? error.message : "退出登录失败",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuGroups = [
    {
      title: "账号管理",
      items: [
        { icon: User, label: "个人资料", href: "/settings/profile" },
        { icon: Shield, label: "账号与安全", href: "/settings/security" },
      ],
    },
    {
      title: "通用",
      items: [
        { icon: Palette, label: "外观", href: "/settings/appearance" },
        { icon: Bell, label: "消息与通知", href: "/settings/notifications" },
        { icon: Eye, label: "隐私设置", href: "/settings/privacy" },
      ],
    },
    {
      title: "支持",
      items: [
        { icon: HelpCircle, label: "关于与帮助", href: "/settings/about" },
      ],
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full max-w-5xl flex-col pb-24">
      <div className="md:hidden">
        <MobilePageHeader title="设置" fallbackHref="/profile" />
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 md:px-6 md:py-8">
          <div className="hidden md:block">
            <p className="section-kicker">账号中心</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">设置与偏好</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              把账号、安全、通知和隐私放到同一处管理，让这个页面看起来像平台的一部分，而不是单独的占位页。
            </p>
          </div>

          <div className="mt-0 grid gap-6 md:mt-8 lg:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="surface-panel p-5 sm:p-6">
              <div className="space-y-6">
                {menuGroups.map((group) => (
                  <section key={group.title} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {group.title}
                      </h2>
                    </div>
                    <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/75">
                      {group.items.map((item, itemIdx) => (
                        <div key={item.label}>
                          <Link
                            href={item.href}
                            className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/60 active:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{item.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {group.title === "账号管理" ? "管理身份与账号信息" : group.title === "支持" ? "了解平台与帮助信息" : "调整日常使用偏好"}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                          {itemIdx < group.items.length - 1 && <Separator className="ml-[4.5rem]" />}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <aside className="space-y-6">
              <section className="surface-panel p-5 sm:p-6">
                <p className="section-kicker">设置概览</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">你的偏好会影响体验</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  从外观、消息到隐私，这里的设置会直接改变你收到的信息和页面显示方式。
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    "先补充个人资料，别人更容易识别你。",
                    "打开通知时，优先只保留你真正需要的提醒。",
                    "隐私设置建议定期检查一次。",
                  ].map((tip) => (
                    <div key={tip} className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                      {tip}
                    </div>
                  ))}
                </div>
              </section>

              <section className="surface-panel p-5 sm:p-6">
                <p className="section-kicker">当前会话</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">退出当前账号</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  如果这是公用设备，建议退出登录后再离开。
                </p>
                <Button
                  variant="destructive"
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-500/10 text-base font-semibold text-red-600 hover:bg-red-500/18 hover:text-red-700 dark:border-red-900/50"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-5 w-5" />
                  {isLoggingOut ? "正在退出..." : "退出登录"}
                </Button>
              </section>
            </aside>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

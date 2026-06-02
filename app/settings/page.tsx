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
    <div className="app-shell-reading flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="设置" fallbackHref="/profile" />
      </div>

      <ScrollArea className="flex-1">
        <div className="page-shell py-4 md:py-8">
          <div className="hidden md:block">
            <p className="section-kicker">账号中心</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">设置</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              管理个人资料、安全、通知、隐私和帮助入口。设置项按使用场景分组，和各子页面保持同一层级。
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
                    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-background/75">
                      {group.items.map((item, itemIdx) => (
                        <div key={item.label}>
                          <Link
                            href={item.href}
                            className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/60 active:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div className="text-sm font-medium">{item.label}</div>
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
                <div className="mb-4">
                  <p className="text-sm font-semibold text-foreground">账号操作</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">退出登录不会删除你的作品、收藏和消息记录。</p>
                </div>
                <Button
                  variant="destructive"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-500/10 text-base font-semibold text-red-600 hover:bg-red-500/18 hover:text-red-700 dark:border-red-900/50"
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

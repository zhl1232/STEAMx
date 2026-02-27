"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, ChevronRight, User, Shield, Bell, Eye, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Placeholder component, real implementations will be distinct components
export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "退出登录失败",
        description: error.message,
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
        { icon: User, label: "个人资料设置", href: "/settings/profile" },
        { icon: Shield, label: "账号与安全", href: "/settings/security" },
      ],
    },
    {
      title: "通用",
      items: [
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
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">设置</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4 pb-20">
          {menuGroups.map((group, index) => (
            <div key={group.title} className="space-y-3">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h2>
              <div className="overflow-hidden rounded-2xl border bg-card">
                {group.items.map((item, itemIdx) => (
                  <div key={item.label}>
                    <button
                      onClick={() => toast({ title: "功能开发中", description: "该页面的具体功能正在紧急开发中..."})}
                      className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {itemIdx < group.items.length - 1 && (
                      <Separator className="ml-14" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4">
            <Button
              variant="destructive"
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-base font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:text-red-700 border border-red-200 dark:border-red-900/50"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="h-5 w-5" />
              {isLoggingOut ? "正在退出..." : "退出登录"}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

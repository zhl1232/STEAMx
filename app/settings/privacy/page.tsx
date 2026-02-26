"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserX, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const menuItems = [
    {
      icon: Unlock,
      label: "主页可见性",
      value: "所有人可见",
      action: () => toast({ title: "功能开发中" }),
    },
    {
      icon: UserX,
      label: "黑名单管理",
      value: "0 人",
      action: () => toast({ title: "功能开发中" }),
    }
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
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
        <h1 className="text-lg font-semibold">隐私设置</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {menuItems.map((item, index) => (
              <div key={item.label}>
                <button
                  onClick={item.action}
                  className="flex w-full items-center justify-between bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="flex items-center gap-3">
                     <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                </button>
                {index < menuItems.length - 1 && <Separator className="ml-14" />}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

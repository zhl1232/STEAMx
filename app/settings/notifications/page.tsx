"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BellRing, Loader2, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

type NotificationPreference = {
  notify_followed_creator_updates: boolean;
};

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference>({
    notify_followed_creator_updates: true,
  });

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notify_followed_creator_updates")
        .eq("id", user.id)
        .single();

      if (error) {
        toast({
          title: "加载通知设置失败",
          description: "请稍后重试",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setPreferences({
        notify_followed_creator_updates:
          (data as NotificationPreference | null)?.notify_followed_creator_updates !== false,
      });
      setIsLoading(false);
    };

    void loadPreferences();
  }, [supabase, toast, user]);

  const handleCreatorUpdateToggle = async () => {
    if (!user || isSaving) return;

    const nextValue = !preferences.notify_followed_creator_updates;
    setIsSaving(true);
    setPreferences((prev) => ({
      ...prev,
      notify_followed_creator_updates: nextValue,
    }));

    const { error } = await supabase
      .from("profiles")
      .update({ notify_followed_creator_updates: nextValue } as never)
      .eq("id", user.id);

    if (error) {
      setPreferences((prev) => ({
        ...prev,
        notify_followed_creator_updates: !nextValue,
      }));
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } else {
      toast({
        title: "已保存",
        description: nextValue ? "已开启创作者更新提醒" : "已关闭创作者更新提醒",
      });
    }

    setIsSaving(false);
  };

  const menuItems = [
    {
      icon: BellRing,
      label: "关注创作者更新",
      value: preferences.notify_followed_creator_updates ? "已开启" : "已关闭",
      description: "关注的创作者发布动态或重大更新时，通过站内消息提醒你。",
      action: handleCreatorUpdateToggle,
    },
    {
      icon: Megaphone,
      label: "系统通知",
      value: "默认开启",
      description: "系统安全提醒和审核结果会继续保留在站内消息中。",
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
        <h1 className="text-lg font-semibold">消息通知设置</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : menuItems.map((item, index) => (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={item.action}
                  disabled={!item.action || isSaving}
                  className="flex w-full items-center justify-between bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-center gap-3">
                     <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-medium text-sm block">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </div>
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

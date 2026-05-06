"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Megaphone } from "lucide-react";

import { SettingsSubpageShell } from "@/app/settings/_components/settings-subpage-shell";
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NotificationPreference = {
  notify_followed_creator_updates: boolean;
};

export default function NotificationsSettingsPage() {
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
      active: preferences.notify_followed_creator_updates,
    },
    {
      icon: Megaphone,
      label: "系统通知",
      value: "默认开启",
      description: "系统安全提醒和审核结果会继续保留在站内消息中。",
      active: true,
    },
  ];

  return (
    <SettingsSubpageShell
      title="消息与通知"
      kicker="通知规则"
      description="管理站内提醒的触发范围。系统安全和审核结果会继续保留，避免错过关键状态。"
    >
      {isLoading ? (
        <div className="surface-subtle flex min-h-56 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {menuItems.map((item) => {
            const isActionable = Boolean(item.action);

            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                disabled={!isActionable || isSaving}
                role={isActionable ? "switch" : undefined}
                aria-checked={isActionable ? item.active : undefined}
                className={cn(
                  "surface-subtle flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-transform",
                  isActionable ? "hover:-translate-y-0.5" : "cursor-default",
                  isSaving && isActionable && "opacity-80",
                )}
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
                {isActionable ? (
                  <span
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
                      item.active ? "border-primary bg-primary/90" : "border-border/80 bg-muted",
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "absolute top-1 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
                        item.active ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {item.value}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </SettingsSubpageShell>
  );
}
